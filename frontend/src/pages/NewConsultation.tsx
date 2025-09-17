import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  Mic,
  MicOff,
  Upload,
  FileAudio
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
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  // Consent recording state (separate from consultation audio)
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentMediaRecorder, setConsentMediaRecorder] = useState<MediaRecorder | null>(null);
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async (search?: string) => {
    try {
      setIsLoadingPatients(true);
      const data = await apiService.getPatients(search);
      setPatients(data);
    } catch (err: any) {
      console.error('Failed to load patients:', err);
      setError('Failed to load patients');
    } finally {
      setIsLoadingPatients(false);
    }
  };

  // Debounced server-side search for patients
  useEffect(() => {
    const handle = setTimeout(() => {
      loadPatients(patientSearch);
    }, 300);
    return () => clearTimeout(handle);
  }, [patientSearch]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError('');
    } catch (e) {
      console.error('Mic access failed', e);
      setError('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setError('');
    }
  };

  // Consent recording/upload handlers
  const startConsentRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setConsentBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setConsentMediaRecorder(recorder);
      setIsRecordingConsent(true);
      setError('');
    } catch (e) {
      console.error('Mic access failed (consent)', e);
      setError('Failed to access microphone for consent recording');
    }
  };

  const stopConsentRecording = () => {
    if (consentMediaRecorder && isRecordingConsent) {
      consentMediaRecorder.stop();
      setConsentMediaRecorder(null);
      setIsRecordingConsent(false);
    }
  };

  const handleConsentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConsentBlob(file);
      setError('');
    }
  };

  // We now fetch filtered patients from server; no client-side filtering needed

  const createConsultation = async () => {
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }
    if (!consentBlob) {
      setError('Please record or upload consent audio before starting the consultation');
      return;
    }
    if (!audioBlob) {
      setError('Please record or upload an audio file for the consultation');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // 1) Create consent first
      const consentForm = new FormData();
      consentForm.append('audio', consentBlob, 'consent-audio.wav');
      consentForm.append('patient_id', selectedPatient);
      if (user?.id) consentForm.append('doctor_id', user.id);
      const consent = await apiService.createConsent(consentForm);

      // 2) Create consultation with consent_id
      const formData = new FormData();
      formData.append('audio', audioBlob, 'consultation-audio.wav');
      formData.append('patient_id', selectedPatient);
      if (user?.id) formData.append('doctor_id', user.id);
      formData.append('consultation_date', new Date(consultationDate).toISOString());
      if (notes.trim()) formData.append('notes', notes.trim());
      if (consent?.id) formData.append('consent_id', consent.id);

      const newConsultation = await apiService.createConsultation(formData);
      
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
                      {patients.length === 0 ? (
                        <div className="p-2 text-gray-500 text-sm">No patients found</div>
                      ) : (
                        patients.map((patient) => (
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

            {/* Consent Recording (Required) */}
            <div className="space-y-2">
              <Label>Patient Consent Audio (Required)</Label>
              <p className="text-sm text-gray-600">Record or upload the patient's verbal consent for this consultation</p>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={isRecordingConsent ? stopConsentRecording : startConsentRecording}
                  className={isRecordingConsent ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                  type="button"
                >
                  {isRecordingConsent ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      Stop Consent Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Record Consent
                    </>
                  )}
                </Button>

                <span className="text-gray-500">or</span>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => consentFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Consent
                </Button>
                <input
                  ref={consentFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleConsentUpload}
                  className="hidden"
                />
              </div>

              {consentBlob && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
                  <FileAudio className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 text-sm">Consent audio ready</span>
                </div>
              )}
            </div>

            {/* Audio Recording (Required) */}
            <div className="space-y-2">
              <Label>Consultation Audio (Required)</Label>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={isRecording ? 'bg-red-600 hover:bg-red-700' : ''}
                  type="button"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>

                <span className="text-gray-500">or</span>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {audioBlob && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center space-x-2">
                  <FileAudio className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-800 text-sm">Audio ready for submission</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={createConsultation}
                disabled={isLoading || !selectedPatient || !consentBlob || !audioBlob}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isLoading ? 'Creating...' : 'Start Consultation with Consent & Audio'}
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
