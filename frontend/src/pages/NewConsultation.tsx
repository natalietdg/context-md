import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Plus,
  Search,
  AlertCircle
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  nric: string;
  email: string;
  phone?: string;
}

const NewConsultation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState('');
  const [consultationDate, setConsultationDate] = useState(
    new Date().toISOString().slice(0, 16) // Current datetime for datetime-local input
  );
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setIsLoadingPatients(true);
      // Assuming there's an API endpoint to get patients for a doctor
      const data = await apiService.getPatients();
      setPatients(data);
    } catch (err: any) {
      console.error('Failed to load patients:', err);
      setError('Failed to load patients');
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const searchTerm = patientSearch.toLowerCase();
    return patient.name.toLowerCase().includes(searchTerm) ||
           patient.nric.toLowerCase().includes(searchTerm) ||
           patient.email.toLowerCase().includes(searchTerm);
  });

  const createConsultation = async () => {
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const consultationData = {
        patient_id: selectedPatient,
        doctor_id: user?.id,
        consultation_date: new Date(consultationDate).toISOString(),
        notes: notes.trim() || undefined,
      };

      const newConsultation = await apiService.createConsultation(consultationData);
      
      // Navigate to the new consultation page
      navigate(`/consultation/${newConsultation.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create consultation');
      console.error('Create consultation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPatientData = patients.find(p => p.id === selectedPatient);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Consultation</h1>
          <p className="text-gray-600">Start a new consultation session with a patient</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Consultation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label htmlFor="patient-search">Select Patient</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="patient-search"
                    placeholder="Search patients by name, NRIC, or email..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {isLoadingPatients ? (
                  <div className="p-4 text-center text-gray-500">Loading patients...</div>
                ) : (
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPatients.length === 0 ? (
                        <div className="p-2 text-gray-500 text-sm">No patients found</div>
                      ) : (
                        filteredPatients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{patient.name}</span>
                              <span className="text-sm text-gray-500">
                                {patient.nric} • {patient.email}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Selected Patient Info */}
            {selectedPatientData && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="font-medium text-blue-900">Selected Patient</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p><strong>Name:</strong> {selectedPatientData.name}</p>
                    <p><strong>NRIC:</strong> {selectedPatientData.nric}</p>
                    <p><strong>Email:</strong> {selectedPatientData.email}</p>
                    {selectedPatientData.phone && (
                      <p><strong>Phone:</strong> {selectedPatientData.phone}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consultation Date/Time */}
            <div className="space-y-2">
              <Label htmlFor="consultation-date">Consultation Date & Time</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="consultation-date"
                  type="datetime-local"
                  value={consultationDate}
                  onChange={(e) => setConsultationDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Initial Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Initial Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any initial notes or observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={createConsultation}
                disabled={isLoading || !selectedPatient}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Creating...' : 'Start Consultation'}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewConsultation;
