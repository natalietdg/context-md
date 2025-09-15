#!/usr/bin/env python3
"""
S3 Audio Downloader for Audio Processing Pipelines

Downloads audio files from S3 bucket for processing with WhisperX, Clinical Transcription, 
or other audio processing pipelines. Unified S3 downloader for the entire project.
"""

import os
import sys
import tempfile
from urllib.parse import urlparse
from typing import Optional
from pathlib import Path

# Optional .env support - load from project root
try:
    from dotenv import load_dotenv
    import os
    # Find project root (parent of aws folder)
    project_root = Path(__file__).parent.parent
    env_path = project_root / '.env'
    load_dotenv(env_path)
except ImportError:
    pass

import boto3
from botocore.exceptions import ClientError, NoCredentialsError


class S3AudioDownloader:
    """S3 client for downloading audio files for various audio processing pipelines"""
    
    def __init__(self, region: Optional[str] = None, cache_dir: Optional[str] = None):
        """
        Initialize AWS S3 client for audio downloads.
        
        Args:
            region: AWS region (defaults to AWS_DEFAULT_REGION env var or ap-southeast-2)
            cache_dir: Local cache directory for downloaded files (optional)
        """
        self.region = region or os.getenv('AWS_DEFAULT_REGION', 'ap-southeast-2')
        self.default_bucket = os.getenv('AUDIO_S3_BUCKET')
        self.cache_dir = Path(cache_dir) if cache_dir else None
        
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            self.s3 = boto3.client('s3', region_name=self.region)
            print(f"✅ Connected to AWS S3 region: {self.region}")
            if self.default_bucket:
                print(f"📦 Default audio bucket: {self.default_bucket}")
            if self.cache_dir:
                print(f"💾 Cache directory: {self.cache_dir}")
        except NoCredentialsError:
            print("❌ AWS credentials not found. Please configure your AWS credentials.")
            print("   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables")
            print("   Or configure AWS CLI: aws configure")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Failed to initialize AWS S3 client: {e}")
            sys.exit(1)
    
    def resolve_s3_uri(self, s3_path: str) -> str:
        """
        Convert S3 path to full S3 URI, using default bucket if needed.
        
        Args:
            s3_path: S3 path in various formats:
                    - s3://bucket/path/file.mp3 (full URI)
                    - s3://file.mp3 (uses default bucket)
                    - path/file.mp3 (uses default bucket)
                    - file.mp3 (uses default bucket)
                    
        Returns:
            Full S3 URI (s3://bucket/path/file.mp3)
        """
        if s3_path.startswith('s3://'):
            parsed = urlparse(s3_path)
            
            # Check if netloc looks like a filename (has extension) rather than bucket name
            if parsed.netloc and '.' in parsed.netloc and parsed.netloc != self.default_bucket:
                # This is s3://filename.ext format, treat netloc as filename
                filename = parsed.netloc
                if not self.default_bucket:
                    raise ValueError("No default bucket configured. Set AUDIO_S3_BUCKET environment variable or provide full S3 URI")
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
                    raise ValueError("No default bucket configured. Set AUDIO_S3_BUCKET environment variable or provide full S3 URI")
                return f"s3://{self.default_bucket}/{filename}"
        
        # Use default bucket from environment for plain filenames
        if not self.default_bucket:
            raise ValueError("No default bucket configured. Set AUDIO_S3_BUCKET environment variable or provide full S3 URI")
        
        # Clean up path (remove leading slash if present)
        clean_path = s3_path.lstrip('/')
        return f"s3://{self.default_bucket}/{clean_path}"
    
    def parse_s3_uri(self, s3_uri: str) -> tuple[str, str]:
        """
        Parse S3 URI into bucket and key components.
        
        Args:
            s3_uri: Full S3 URI (s3://bucket/path/file.ext)
            
        Returns:
            Tuple of (bucket_name, object_key)
        """
        if not s3_uri.startswith('s3://'):
            raise ValueError("URI must start with 's3://'")
        
        parsed = urlparse(s3_uri)
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
        
        if not bucket or not key:
            raise ValueError("Invalid S3 URI format")
            
        return bucket, key
    
    def verify_s3_file(self, bucket: str, key: str) -> bool:
        """
        Verify that the S3 file exists and is accessible.
        
        Args:
            bucket: S3 bucket name
            key: S3 object key
            
        Returns:
            True if file exists and is accessible, False otherwise
        """
        try:
            print(f"🔍 Checking S3 file: s3://{bucket}/{key}")
            response = self.s3.head_object(Bucket=bucket, Key=key)
            file_size = response.get('ContentLength', 'unknown')
            print(f"✅ File found: {file_size} bytes")
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
    
    def get_cached_path(self, s3_uri: str) -> Optional[str]:
        """
        Get cached local path for S3 file if it exists.
        
        Args:
            s3_uri: Full S3 URI
            
        Returns:
            Local path if cached file exists, None otherwise
        """
        if not self.cache_dir:
            return None
            
        bucket, key = self.parse_s3_uri(s3_uri)
        filename = os.path.basename(key)
        cached_path = self.cache_dir / filename
        
        if cached_path.exists():
            print(f"💾 Using cached file: {cached_path}")
            return str(cached_path)
        
        return None
    
    def download_audio_file(self, s3_path: str, local_dir: Optional[str] = None, use_cache: bool = True) -> str:
        """
        Download audio file from S3 to local directory.
        
        Args:
            s3_path: S3 path in various formats (see resolve_s3_uri for supported formats)
            local_dir: Local directory to save file (optional, uses temp dir if not provided)
            use_cache: Whether to check cache directory for existing file
            
        Returns:
            Local path to downloaded file
        """
        # Resolve to full S3 URI
        s3_uri = self.resolve_s3_uri(s3_path)
        print(f"🎵 Full S3 URI: {s3_uri}")
        
        # Check cache first if enabled
        if use_cache and self.cache_dir:
            cached_path = self.get_cached_path(s3_uri)
            if cached_path:
                return cached_path
        
        bucket, key = self.parse_s3_uri(s3_uri)
        
        # Verify file exists
        if not self.verify_s3_file(bucket, key):
            raise FileNotFoundError(f"S3 file not found or not accessible: {s3_uri}")
        
        # Determine local file path
        filename = os.path.basename(key)
        
        if local_dir:
            local_dir_path = Path(local_dir)
            local_dir_path.mkdir(parents=True, exist_ok=True)
            local_path = local_dir_path / filename
        elif self.cache_dir:
            # Use cache directory
            local_path = self.cache_dir / filename
        else:
            # Use temporary directory
            temp_dir = tempfile.mkdtemp()
            local_path = Path(temp_dir) / filename
        
        try:
            print(f"📥 Downloading {s3_uri} to {local_path}")
            self.s3.download_file(bucket, key, str(local_path))
            print(f"✅ Downloaded successfully: {local_path}")
            return str(local_path)
        except ClientError as e:
            error_msg = f"Failed to download file: {e.response['Error']['Message']}"
            print(f"❌ {error_msg}")
            raise RuntimeError(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error during download: {str(e)}"
            print(f"❌ {error_msg}")
            raise RuntimeError(error_msg)
    
    def list_audio_files(self, prefix: str = "", bucket: Optional[str] = None) -> list[str]:
        """
        List audio files in S3 bucket with given prefix.
        
        Args:
            prefix: S3 key prefix to filter files
            bucket: S3 bucket name (uses default if not provided)
            
        Returns:
            List of S3 URIs for audio files
        """
        bucket = bucket or self.default_bucket
        if not bucket:
            raise ValueError("No bucket specified and no default bucket configured")
        
        audio_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'}
        audio_files = []
        
        try:
            paginator = self.s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        if any(key.lower().endswith(ext) for ext in audio_extensions):
                            audio_files.append(f"s3://{bucket}/{key}")
        except ClientError as e:
            print(f"❌ Error listing files: {e.response['Error']['Message']}")
            raise
        
        return audio_files


def main():
    """Main entry point for testing and standalone usage"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Download audio files from S3 for audio processing pipelines'
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
        '--cache-dir', '-c',
        help='Cache directory for downloaded files'
    )
    parser.add_argument(
        '--region', '-r',
        help='AWS region (default: from AWS_DEFAULT_REGION env var)'
    )
    parser.add_argument(
        '--list', '-l',
        help='List audio files with given prefix instead of downloading'
    )
    
    args = parser.parse_args()
    
    # Create downloader
    downloader = S3AudioDownloader(region=args.region, cache_dir=args.cache_dir)
    
    if args.list:
        # List files mode
        files = downloader.list_audio_files(prefix=args.list)
        print(f"🎵 Found {len(files)} audio files:")
        for file_uri in files:
            print(f"  {file_uri}")
    else:
        # Download file mode
        try:
            local_path = downloader.download_audio_file(args.s3_path, args.output_dir)
            print(f"🎉 File ready for processing: {local_path}")
        except Exception as e:
            print(f"❌ Download failed: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main() 