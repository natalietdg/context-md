# ContextMD - Healthcare Audio Processing System

A comprehensive healthcare platform that processes consultation audio recordings through advanced AI pipelines for transcription, translation, and clinical information extraction. Built with NestJS backend, React frontend, and Python-based audio processing.

## 🏥 System Overview

ContextMD is a HIPAA-compliant healthcare system that:
- Records and processes patient consultation audio
- Transcribes multi-language conversations using WhisperX
- Translates content to English using SEA-LION AI
- Extracts clinical information using LLM models
- Provides secure patient data management with encryption
- Offers real-time consent verification

## 🏗️ Architecture

```
ContextMD/
├── backend/api/           # NestJS Backend API
│   ├── src/
│   │   ├── auth/         # Authentication & JWT
│   │   ├── consultation/ # Consultation management
│   │   ├── entities/     # Database entities (encrypted)
│   │   ├── shared/       # S3, speech processing services
│   │   └── main.ts       # Application entry point
│   ├── dist/             # Compiled TypeScript
│   └── .ebextensions/    # AWS Elastic Beanstalk config
├── frontend/             # React Frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Application pages
│   │   ├── contexts/     # React contexts (Auth)
│   │   └── services/     # API service layer
│   └── public/           # Static assets
├── scripts/              # Deployment scripts
├── aws/                  # AWS utilities
├── whisperX/             # Audio transcription
├── sealion/              # Translation services
├── clinical_extractor_llm/ # Clinical data extraction
├── pipeline.py           # Main audio processing pipeline
└── requirements.txt      # Python dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL database
- AWS account with S3 access
- SEA-LION API key

### 1. Clone Repository
```bash
git clone https://github.com/natalietdg/context-md.git
cd context-md
```

### 2. Backend Setup
```bash
# Install Node.js dependencies
cd backend/api
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Build the application
npm run build

# Run database migrations (if applicable)
# npm run migration:run
```

### 3. Python Environment Setup
```bash
# Return to project root
cd ../..

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Frontend Setup
```bash
cd frontend
npm install

# Create environment file
cp .env.example .env
# Configure frontend environment variables

# Build for production
npm run build
```

### 5. Start Development Servers

**Backend:**
```bash
cd backend/api
npm run start:dev  # Development mode
# or
npm run start:prod  # Production mode
```

**Frontend:**
```bash
cd frontend
npm start  # Development server on http://localhost:3000
```

**Full System (Production):**
```bash
# From project root
./scripts/start.sh  # Starts backend with Python pipeline support
```

## ✨ Features

### 🏥 **Healthcare Management**
- **Patient Management**: Secure patient registration and data management
- **Doctor Dashboard**: Comprehensive consultation overview and scheduling
- **Consultation Recording**: Audio recording with pause/resume functionality
- **Real-time Consent**: Live consent verification with speech recognition
- **Report Generation**: Automated clinical report generation
- **Multi-language Support**: English, Malay, Chinese interface and processing

### 🔒 **Security & Compliance**
- **Data Encryption**: AES-256-CBC encryption for all sensitive data
- **HIPAA Compliance**: Healthcare data protection standards
- **JWT Authentication**: Secure user authentication and authorization
- **Role-based Access**: Doctor and patient role separation
- **Audit Logging**: Comprehensive activity tracking

### 🎵 **Audio Processing Pipeline**
- **WhisperX Transcription**: Advanced multi-language speech-to-text
- **Speaker Diarization**: Automatic speaker identification and separation
- **SEA-LION Translation**: AI-powered translation to English
- **Clinical Extraction**: LLM-based medical information extraction
- **S3 Integration**: Secure cloud audio storage and processing

### 🌐 **Modern Tech Stack**
- **Backend**: NestJS with TypeScript, PostgreSQL database
- **Frontend**: React with TypeScript, modern UI components
- **AI/ML**: Python-based pipeline with OpenAI, WhisperX, SEA-LION
- **Cloud**: AWS S3, Elastic Beanstalk deployment ready
- **DevOps**: Docker support, automated CI/CD with GitHub Actions

## 🔧 Environment Variables

### Backend Configuration (.env)
```bash
# Database
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_USER=your-db-user
DATABASE_PASSWORD=your-db-password
DATABASE_NAME=contextmd
DB_ENCRYPTION_KEY=your-32-byte-encryption-key

# JWT
JWT_SECRET=your-jwt-secret

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_DEFAULT_REGION=ap-southeast-1
AWS_S3_BUCKET=your-s3-bucket

# AI Services
SEALION_API_KEY=your-sealion-api-key
HF_TOKEN=your-huggingface-token
OPENAI_API_KEY=your-openai-api-key

# Application
NODE_ENV=development
PORT=8080
```

### Frontend Configuration (.env)
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_ENVIRONMENT=development
```

## 🧪 Testing

### Backend Tests
```bash
cd backend/api
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:cov      # Coverage report
```

### Frontend Tests
```bash
cd frontend
npm test              # Run test suite
npm run test:coverage # Coverage report
```

### Manual Testing
1. **User Registration**: Create doctor and patient accounts
2. **Authentication**: Test login/logout functionality
3. **Consultation Flow**: Record audio, verify consent, create consultation
4. **Audio Processing**: Upload audio files and verify transcription pipeline
5. **Report Generation**: Check clinical information extraction

### API Testing
Use the provided Postman collection in `POSTMAN_API_TESTING.md` for comprehensive API testing.

## 🚀 Deployment

### AWS Elastic Beanstalk
```bash
# Build and deploy
npm run build
eb deploy

# Set environment variables in EB Console:
# - VENV_PYTHON=/var/app/current/venv/bin/python3
# - PIPELINE_PATH=/var/app/current/pipeline.py
# - REPO_ROOT=/var/app/current
```

### Docker Deployment
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Install dependencies (Node.js and Python)
4. Build applications
5. Start services using `./scripts/start.sh`

## 📋 API Documentation

### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/register` - Doctor registration

### Consultation Endpoints
- `GET /consultation` - List consultations
- `POST /consultation` - Create consultation with audio
- `GET /consultation/:id` - Get consultation details
- `POST /consultation/:id/process` - Process audio through pipeline

### Patient Management
- `GET /patients` - List patients
- `POST /patients` - Create patient
- `GET /patients/:id` - Get patient details

See `SYSTEM_ARCHITECTURE.md` for detailed API specifications.

## 🔍 Troubleshooting

### Common Issues

**Database Connection**
```bash
# Check PostgreSQL connection
psql -h your-host -U your-user -d contextmd
```

**Python Pipeline Errors**
```bash
# Verify Python environment
source venv/bin/activate
python --version
pip list
```

**Audio Processing Issues**
```bash
# Check FFmpeg installation
ffmpeg -version

# Verify S3 access
aws s3 ls s3://your-bucket
```

**Frontend Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript/JavaScript best practices
- Write tests for new features
- Update documentation for API changes
- Ensure HIPAA compliance for healthcare data
- Test with multiple audio formats and languages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WhisperX for advanced speech recognition
- SEA-LION for multilingual AI translation
- NestJS and React communities
- AWS for cloud infrastructure
- OpenAI for LLM capabilities

## 📞 Support

For support and questions:
- Create an issue in this repository
- Check existing documentation in `/docs` folder
- Review system architecture in `SYSTEM_ARCHITECTURE.md`

---

**Note**: This is an open-source healthcare application. Ensure proper security measures and compliance with local healthcare regulations before deploying in production environments. 