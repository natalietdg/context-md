# ContextMD API Testing with Postman

This guide shows how to test all ContextMD API endpoints using Postman with the API key bypass feature.

## 🔑 **API Key Setup**

### **Environment Variable**
Add to your `.env` file:
```bash
API_KEY=contextmd-dev-api-key-2024
```

### **Postman Headers**
Add this header to all your requests:
```
Key: x-api-key
Value: contextmd-dev-api-key-2024
```

Or alternatively:
```
Key: api-key  
Value: contextmd-dev-api-key-2024
```

## 📋 **API Endpoints for Testing**

### **1. Create Sample Doctor**
```
POST http://localhost:4000/seed/sample-doctor
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **2. Create Sample Patient**
```
POST http://localhost:4000/seed/sample-patient
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **3. Create Bulk Doctors**
```
POST http://localhost:4000/seed/bulk-doctors
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **4. Create Bulk Patients**
```
POST http://localhost:4000/seed/bulk-patients
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **5. Create Custom Doctor**
```
POST http://localhost:4000/users/doctor
Headers: x-api-key: contextmd-dev-api-key-2024
Content-Type: application/json

Body:
{
  "email": "custom.doctor@hospital.com",
  "password": "SecurePass123!",
  "name": "Dr. Custom Name",
  "employee_id": "DOC999",
  "department": "Emergency Medicine"
}
```

### **6. Create Custom Patient**
```
POST http://localhost:4000/users/patient
Headers: x-api-key: contextmd-dev-api-key-2024
Content-Type: application/json

Body:
{
  "email": "custom.patient@email.com",
  "password": "SecurePass123!",
  "name": "Custom Patient",
  "nric": "S9999999Z",
  "phone": "+65 9999 9999",
  "allergies": "Custom allergies",
  "medication": "Custom medication",
  "medical_history": "Custom medical history"
}
```

### **7. Login User**
```
POST http://localhost:4000/users/login
Content-Type: application/json

Body:
{
  "email": "dr.smith@contextmd.com",
  "password": "SecurePass123!"
}
```

### **8. List All Users**
```
GET http://localhost:4000/users
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **9. Get User by ID**
```
GET http://localhost:4000/users/{user-id}
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **10. Get User with Profile**
```
GET http://localhost:4000/users/{user-id}/profile
Headers: x-api-key: contextmd-dev-api-key-2024
```

### **11. Update User**
```
PATCH http://localhost:4000/users/{user-id}
Headers: x-api-key: contextmd-dev-api-key-2024
Content-Type: application/json

Body:
{
  "is_active": false
}
```

### **12. Delete User (Soft Delete)**
```
DELETE http://localhost:4000/users/{user-id}
Headers: x-api-key: contextmd-dev-api-key-2024
```

## 🚀 **Quick Start Testing Sequence**

1. **Create sample data:**
   ```bash
   POST /seed/sample-doctor
   POST /seed/sample-patient
   POST /seed/bulk-doctors
   POST /seed/bulk-patients
   ```

2. **Test login:**
   ```bash
   POST /users/login
   # Use: dr.smith@contextmd.com / SecurePass123!
   ```

3. **List all users:**
   ```bash
   GET /users
   ```

4. **Create custom profiles:**
   ```bash
   POST /users/doctor
   POST /users/patient
   ```

## 🔒 **Security Notes**

- **API Key Bypass:** The `x-api-key` header bypasses JWT authentication for testing
- **Mock User:** API key requests get doctor-level privileges automatically
- **Production Safety:** Change the API key in production environments
- **Development Only:** This bypass is intended for development and testing

## 📝 **Postman Collection Setup**

1. Create a new Postman collection
2. Add environment variable: `api_key = contextmd-dev-api-key-2024`
3. Set collection-level header: `x-api-key: {{api_key}}`
4. Import all endpoints above
5. Test away!

## 🛠 **Environment Variables**

Make sure your `.env` file contains:
```bash
# Required for API key bypass
API_KEY=contextmd-dev-api-key-2024

# Required for JWT tokens
JWT_SECRET=your-jwt-secret-key-here

# Required for encryption
DB_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Database connection
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=contextmd
DATABASE_USER=your-username
DATABASE_PASSWORD=your-password
```
