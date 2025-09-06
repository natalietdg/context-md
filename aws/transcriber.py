#!/usr/bin/env python3
"""
AWS Transcriber

Reads .m4a files from S3 and transcribes them using Amazon Transcribe.
Outputs both plain text and full JSON transcript files.

Requirements:
- Python 3.9+
- boto3, requests (pip install boto3 requests)
- Optional: python-dotenv for .env support

Usage:
    python aws_transcriber.py path/to/file.m4a                        # Uses AUDIO_S3_BUCKET from .env
    python aws_transcriber.py s3://bucket-name/path/to/file.m4a        # Full S3 URI
    python aws_transcriber.py path/to/file.m4a --language en-US        # With language specification
"""

import os
import sys
import time
import json
import argparse
from urllib.parse import urlparse
from typing import Optional, Dict, Any

# Optional .env support - continue silently if not available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import boto3
import requests
from botocore.exceptions import ClientError, NoCredentialsError


class AWSTranscriber:
    """AWS Transcribe client for processing .m4a files from S3"""
    
    SUPPORTED_LANGUAGES = {
        'auto': None,  # Automatic detection from filtered list
        'en-US': 'en-US',
        'zh-CN': 'zh-CN', 
        'ms-MY': 'ms-MY'
    }
    
    # Language options for automatic detection
    AUTO_LANGUAGE_OPTIONS = ['en-US', 'zh-CN', 'ms-MY']
    
    def __init__(self, region: Optional[str] = None):
        """Initialize AWS clients"""
        self.region = region or os.getenv('AWS_DEFAULT_REGION', 'ap-southeast-2')
        self.default_bucket = os.getenv('AUDIO_S3_BUCKET')
        
        try:
            self.transcribe = boto3.client('transcribe', region_name=self.region)
            self.s3 = boto3.client('s3', region_name=self.region)
            print(f"✅ Connected to AWS region: {self.region}")
            if self.default_bucket:
                print(f"📦 Default audio bucket: {self.default_bucket}")
        except NoCredentialsError:
            print("❌ AWS credentials not found. Please configure your AWS credentials.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Failed to initialize AWS clients: {e}")
            sys.exit(1)
    
    def resolve_s3_uri(self, s3_path: str) -> str:
        """Convert S3 path to full S3 URI, using default bucket if needed"""
        if s3_path.startswith('s3://'):
            return s3_path
        
        # Use default bucket from environment
        if not self.default_bucket:
            print("❌ No default bucket configured. Set AUDIO_S3_BUCKET in .env or provide full S3 URI")
            sys.exit(1)
        
        # Clean up path (remove leading slash if present)
        clean_path = s3_path.lstrip('/')
        return f"s3://{self.default_bucket}/{clean_path}"
    
    def parse_s3_uri(self, s3_uri: str) -> tuple[str, str]:
        """Parse S3 URI into bucket and key components"""
        if not s3_uri.startswith('s3://'):
            raise ValueError("URI must start with 's3://'")
        
        parsed = urlparse(s3_uri)
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
        
        if not bucket or not key:
            raise ValueError("Invalid S3 URI format")
            
        return bucket, key
    
    def get_bucket_region(self, bucket: str) -> str:
        """Get the region of an S3 bucket"""
        try:
            # Use a region-agnostic client to get bucket location
            s3_global = boto3.client('s3')
            response = s3_global.get_bucket_location(Bucket=bucket)
            # AWS returns None for us-east-1 (classic region)
            bucket_region = response['LocationConstraint'] or 'us-east-1'
            return bucket_region
        except ClientError as e:
            print(f"⚠️  Could not determine bucket region: {e.response['Error']['Message']}")
            return None
    
    def verify_s3_file(self, bucket: str, key: str) -> bool:
        """Verify that the S3 file exists and is accessible"""
        try:
            print(f"🔍 Checking S3 file: s3://{bucket}/{key}")
            print(f"🔍 Using region: {self.region}")
            
            # Check bucket region first
            bucket_region = self.get_bucket_region(bucket)
            if bucket_region and bucket_region != self.region:
                print(f"⚠️  Region mismatch detected!")
                print(f"   Your configured region: {self.region}")
                print(f"   Bucket '{bucket}' is in: {bucket_region}")
                print(f"🔄 Switching to bucket's region...")
                
                # Create S3 client in the correct region
                s3_correct_region = boto3.client('s3', region_name=bucket_region)
                response = s3_correct_region.head_object(Bucket=bucket, Key=key)
                print(f"✅ File found: {response.get('ContentLength', 'unknown')} bytes")
                
                # Update our S3 client to use the correct region
                self.s3 = s3_correct_region
                return True
            
            response = self.s3.head_object(Bucket=bucket, Key=key)
            print(f"✅ File found: {response.get('ContentLength', 'unknown')} bytes")
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            print(f"🔍 AWS Error Code: {error_code}")
            if error_code == '404':
                print(f"❌ File not found: s3://{bucket}/{key}")
            elif error_code == '403':
                print(f"❌ Access denied: s3://{bucket}/{key}")
            elif error_code == 'NoSuchBucket':
                print(f"❌ Bucket does not exist: {bucket}")
            elif error_code == '400':
                print(f"❌ Bad Request - likely region mismatch")
                print(f"   Try setting the correct AWS region for your bucket")
            else:
                print(f"❌ Error accessing file: {e.response['Error']['Message']}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return False
    
    def start_transcription_job(self, s3_path: str, language: str = 'auto') -> str:
        """Start a transcription job and return the job name"""
        # Resolve to full S3 URI
        s3_uri = self.resolve_s3_uri(s3_path)
        print(f"🎵 Full S3 URI: {s3_uri}")
        
        bucket, key = self.parse_s3_uri(s3_uri)
        
        # Verify file exists
        if not self.verify_s3_file(bucket, key):
            sys.exit(1)
        
        # Generate unique job name
        base_name = os.path.splitext(os.path.basename(key))[0]
        timestamp = int(time.time())
        job_name = f"{base_name}-{timestamp}"
        
        # Prepare transcription job parameters
        job_params = {
            'TranscriptionJobName': job_name,
            'Media': {
                'MediaFileUri': s3_uri
            },
            'MediaFormat': 'm4a',
            'Settings': {
                'ShowSpeakerLabels': True,
                'MaxSpeakerLabels': 2
            }
        }
        
        # Set language parameters
        if language == 'auto':
            job_params['IdentifyLanguage'] = True
            job_params['LanguageOptions'] = self.AUTO_LANGUAGE_OPTIONS
            print(f"🌍 Using automatic language detection from: {', '.join(self.AUTO_LANGUAGE_OPTIONS)}")
        else:
            job_params['LanguageCode'] = language
            print(f"🗣️  Using language: {language}")
        
        try:
            response = self.transcribe.start_transcription_job(**job_params)
            print(f"🚀 Started transcription job: {job_name}")
            return job_name
        except ClientError as e:
            print(f"❌ Failed to start transcription job: {e.response['Error']['Message']}")
            sys.exit(1)
    
    def wait_for_completion(self, job_name: str) -> Dict[str, Any]:
        """Poll transcription job until completion"""
        print("⏳ Waiting for transcription to complete...")
        
        while True:
            try:
                response = self.transcribe.get_transcription_job(
                    TranscriptionJobName=job_name
                )
                
                job = response['TranscriptionJob']
                status = job['TranscriptionJobStatus']
                
                if status == 'COMPLETED':
                    print("✅ Transcription completed!")
                    return job
                elif status == 'FAILED':
                    failure_reason = job.get('FailureReason', 'Unknown error')
                    print(f"❌ Transcription failed: {failure_reason}")
                    sys.exit(1)
                elif status in ['IN_PROGRESS', 'QUEUED']:
                    print(f"⏳ Status: {status} - waiting 30 seconds...")
                    time.sleep(30)
                else:
                    print(f"⚠️  Unknown status: {status}")
                    time.sleep(30)
                    
            except ClientError as e:
                print(f"❌ Error checking job status: {e.response['Error']['Message']}")
                sys.exit(1)
    
    def download_transcript(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Download transcript JSON from the pre-signed URL"""
        try:
            transcript_uri = job['Transcript']['TranscriptFileUri']
            print(f"📥 Downloading transcript from: {transcript_uri}")
            
            response = requests.get(transcript_uri)
            response.raise_for_status()
            
            transcript_data = response.json()
            print("✅ Transcript downloaded successfully")
            return transcript_data
            
        except requests.RequestException as e:
            print(f"❌ Failed to download transcript: {e}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse transcript JSON: {e}")
            sys.exit(1)
    
    def extract_plain_text(self, transcript_data: Dict[str, Any]) -> str:
        """Extract plain text from transcript JSON with speaker labels"""
        try:
            results = transcript_data['results']
            
            # Check if we have speaker labels
            if 'speaker_labels' in results and results['speaker_labels']['speakers']:
                return self._extract_with_speakers(results)
            else:
                return self._extract_without_speakers(results)
                
        except KeyError as e:
            print(f"❌ Error parsing transcript structure: {e}")
            return ""
    
    def _extract_with_speakers(self, results: Dict[str, Any]) -> str:
        """Extract text with speaker diarization"""
        segments = results['speaker_labels']['segments']
        items = results['items']
        
        # Create a mapping of item indices to words
        word_map = {}
        for i, item in enumerate(items):
            if item['type'] == 'pronunciation':
                word_map[float(item['start_time'])] = {
                    'word': item['alternatives'][0]['content'],
                    'end_time': float(item['end_time'])
                }
        
        # Build transcript with speaker labels
        transcript_lines = []
        current_speaker = None
        current_line = []
        
        for segment in segments:
            speaker = segment['speaker_label']
            start_time = float(segment['start_time'])
            end_time = float(segment['end_time'])
            
            # Find words in this segment
            segment_words = []
            for word_time, word_data in word_map.items():
                if start_time <= word_time <= end_time:
                    segment_words.append(word_data['word'])
            
            segment_text = ' '.join(segment_words)
            
            if speaker != current_speaker:
                if current_line:
                    transcript_lines.append(f"Speaker {current_speaker}: {' '.join(current_line)}")
                    current_line = []
                current_speaker = speaker
            
            if segment_text.strip():
                current_line.extend(segment_words)
        
        # Add final line
        if current_line:
            transcript_lines.append(f"Speaker {current_speaker}: {' '.join(current_line)}")
        
        return '\n\n'.join(transcript_lines)
    
    def _extract_without_speakers(self, results: Dict[str, Any]) -> str:
        """Extract plain text without speaker labels"""
        transcripts = results.get('transcripts', [])
        if transcripts:
            return transcripts[0].get('transcript', '')
        return ''
    
    def save_files(self, s3_uri: str, transcript_data: Dict[str, Any], plain_text: str):
        """Save transcript files to disk"""
        bucket, key = self.parse_s3_uri(s3_uri)
        base_name = os.path.splitext(os.path.basename(key))[0]
        
        # Create output directory in aws folder
        aws_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(aws_dir, "transcript_output")
        os.makedirs(output_dir, exist_ok=True)
        
        # Save JSON file
        json_filename = os.path.join(output_dir, f"{base_name}_transcript.json")
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(transcript_data, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved full transcript: {json_filename}")
        
        # Save plain text file
        txt_filename = os.path.join(output_dir, f"{base_name}_transcript.txt")
        with open(txt_filename, 'w', encoding='utf-8') as f:
            f.write(plain_text)
        print(f"💾 Saved plain text: {txt_filename}")
    
    def transcribe_file(self, s3_path: str, language: str = 'auto'):
        """Main method to transcribe an S3 file"""
        print(f"🎵 Starting transcription for: {s3_path}")
        
        # Start transcription job
        job_name = self.start_transcription_job(s3_path, language)
        
        # Get the full S3 URI for later use
        s3_uri = self.resolve_s3_uri(s3_path)
        
        # Wait for completion
        job = self.wait_for_completion(job_name)
        
        # Download transcript
        transcript_data = self.download_transcript(job)
        
        # Extract plain text
        plain_text = self.extract_plain_text(transcript_data)
        
        # Save files
        self.save_files(s3_uri, transcript_data, plain_text)
        
        print("🎉 Transcription complete!")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Transcribe .m4a files from S3 using AWS Transcribe'
    )
    parser.add_argument(
        's3_path', 
        help='S3 path to the .m4a file (path/file.m4a) or full S3 URI (s3://bucket/path/file.m4a)'
    )
    parser.add_argument(
        '--language', '-l',
        choices=['auto', 'en-US', 'zh-CN', 'ms-MY'],
        default='auto',
        help='Language for transcription (default: auto-detect)'
    )
    parser.add_argument(
        '--region', '-r',
        help='AWS region (default: from AWS_DEFAULT_REGION env var or us-east-1)'
    )
    
    args = parser.parse_args()
    
    # Validate file extension
    if not args.s3_path.lower().endswith('.m4a'):
        print("❌ Error: File must be a .m4a file")
        sys.exit(1)
    
    # Create transcriber and process file
    transcriber = AWSTranscriber(region=args.region)
    transcriber.transcribe_file(args.s3_path, args.language)


if __name__ == '__main__':
    main() 