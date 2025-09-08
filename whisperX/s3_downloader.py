#!/usr/bin/env python3
"""
S3 Audio Downloader for WhisperX

Downloads audio files from S3 bucket for processing with WhisperX.
Based on the existing AWS transcriber implementation.
"""

import os
import sys
import tempfile
from urllib.parse import urlparse
from typing import Optional

# Optional .env support - load from project root
try:
    from dotenv import load_dotenv
    import os
    # Find project root (parent of whisperX folder)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, '.env')
    load_dotenv(env_path)
except ImportError:
    pass

import boto3
from botocore.exceptions import ClientError, NoCredentialsError


class S3AudioDownloader:
    """S3 client for downloading audio files"""
    
    def __init__(self, region: Optional[str] = None):
        """Initialize AWS clients"""
        self.region = region or os.getenv('AWS_DEFAULT_REGION', 'ap-southeast-2')
        self.default_bucket = os.getenv('AUDIO_S3_BUCKET')
        
        try:
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
            parsed = urlparse(s3_path)
            
            # Check if netloc looks like a filename (has extension) rather than bucket name
            if parsed.netloc and '.' in parsed.netloc and parsed.netloc != self.default_bucket:
                # This is s3://filename.ext format, treat netloc as filename
                filename = parsed.netloc
                if not self.default_bucket:
                    print("❌ No default bucket configured. Set AUDIO_S3_BUCKET in .env or provide full S3 URI")
                    sys.exit(1)
                return f"s3://{self.default_bucket}/{filename}"
            elif parsed.netloc and parsed.path:
                # This is proper s3://bucket/path format
                return s3_path
            elif parsed.netloc:
                # This is s3://bucket format (no file)
                return s3_path
            else:
                # This shouldn't happen, but handle gracefully
                filename = parsed.path.lstrip('/')
                if not self.default_bucket:
                    print("❌ No default bucket configured. Set AUDIO_S3_BUCKET in .env or provide full S3 URI")
                    sys.exit(1)
                return f"s3://{self.default_bucket}/{filename}"
        
        # Use default bucket from environment for plain filenames
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
    
    def verify_s3_file(self, bucket: str, key: str) -> bool:
        """Verify that the S3 file exists and is accessible"""
        try:
            print(f"🔍 Checking S3 file: s3://{bucket}/{key}")
            response = self.s3.head_object(Bucket=bucket, Key=key)
            print(f"✅ File found: {response.get('ContentLength', 'unknown')} bytes")
            return True
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                print(f"❌ File not found: s3://{bucket}/{key}")
            elif error_code == '403':
                print(f"❌ Access denied: s3://{bucket}/{key}")
            elif error_code == 'NoSuchBucket':
                print(f"❌ Bucket does not exist: {bucket}")
            else:
                print(f"❌ Error accessing file: {e.response['Error']['Message']}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return False
    
    def download_audio_file(self, s3_path: str, local_dir: Optional[str] = None) -> str:
        """Download audio file from S3 to local temporary directory"""
        # Resolve to full S3 URI
        s3_uri = self.resolve_s3_uri(s3_path)
        print(f"🎵 Full S3 URI: {s3_uri}")
        
        bucket, key = self.parse_s3_uri(s3_uri)
        
        # Verify file exists
        if not self.verify_s3_file(bucket, key):
            sys.exit(1)
        
        # Determine local file path
        filename = os.path.basename(key)
        if local_dir:
            os.makedirs(local_dir, exist_ok=True)
            local_path = os.path.join(local_dir, filename)
        else:
            # Use temporary directory
            temp_dir = tempfile.mkdtemp()
            local_path = os.path.join(temp_dir, filename)
        
        try:
            print(f"📥 Downloading {s3_uri} to {local_path}")
            self.s3.download_file(bucket, key, local_path)
            print(f"✅ Downloaded successfully: {local_path}")
            return local_path
        except ClientError as e:
            print(f"❌ Failed to download file: {e.response['Error']['Message']}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Unexpected error during download: {str(e)}")
            sys.exit(1)


def main():
    """Main entry point for testing"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Download audio files from S3'
    )
    parser.add_argument(
        's3_path', 
        help='S3 path to the audio file (path/file.mp3) or full S3 URI (s3://bucket/path/file.mp3)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        help='Local directory to save downloaded file (default: temp directory)'
    )
    parser.add_argument(
        '--region', '-r',
        help='AWS region (default: from AWS_DEFAULT_REGION env var)'
    )
    
    args = parser.parse_args()
    
    # Create downloader and download file
    downloader = S3AudioDownloader(region=args.region)
    local_path = downloader.download_audio_file(args.s3_path, args.output_dir)
    print(f"🎉 File ready for processing: {local_path}")


if __name__ == '__main__':
    main() 