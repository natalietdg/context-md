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
  FileAudio,
  Shield,
  Pause,
  Play
} from 'lucide-react';
import { LiveConsentKaraoke } from '../components/LiveConsentKaraoke';

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
  const [isPaused, setIsPaused] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingChunks, setRecordingChunks] = useState<BlobPart[]>([]);
  // Consent recording state (separate from consultation audio)
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentMediaRecorder, setConsentMediaRecorder] = useState<MediaRecorder | null>(null);
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentFileInputRef = useRef<HTMLInputElement>(null);
  
  // Consent karaoke state
  const [language, setLanguage] = useState<'en' | 'ms' | 'zh'>('en');
  const [externalFinal, setExternalFinal] = useState<string>('');
  const [externalInterim, setExternalInterim] = useState<string>('');
  
  // Consent script data
  const currentScript = {
    words: [
      'I', 'consent', 'to', 'this', 'consultation', 'being', 'recorded', 'for', 'medical', 'purposes', 'and', 'data', 'protection', 'compliance'
    ]
  };
  
  const consentLines = [
    'I consent to this consultation being recorded for medical purposes and data protection compliance.'
  ];

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
        if (event.data.size > 0) {
          chunks.push(event.data);
          setRecordingChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingChunks([]);
      setError('');
    } catch (e) {
      console.error('Mic access failed', e);
      setError('Failed to access microphone');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && isRecording && !isPaused) {
      mediaRecorder.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && isRecording && isPaused) {
      mediaRecorder.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      setIsPaused(false);
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

            {/* Live Consent Verification */}
            <div className="space-y-4">
              <Label>Patient Consent (Required)</Label>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="mb-4">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={(value: 'en' | 'ms' | 'zh') => setLanguage(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ms">Bahasa Malaysia</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-amber-800 mb-3">
                  Doctor: Please read the following consent statement to the patient. The system will detect when they have spoken the required percentage of the text.
                </p>
                <p className="text-xs text-amber-700 mb-4">
                  Patient needs to repeat back the consent statement with at least 70% accuracy. This will be recorded for PDPA compliance.
                </p>
                
                <LiveConsentKaraoke
                  words={currentScript?.words}
                  lines={consentLines}
                  language={language === 'ms' ? 'ms-MY' : (language === 'zh') ? 'zh-CN' : 'en-US'}
                  sentenceMode={true}
                  sentenceThreshold={0.7}
                  externalFinal={externalFinal}
                  externalInterim={externalInterim}
                  ignoreBracketed={true}
                  requirePDPAKeyword={true}
                  onAudioReady={(audioBlob) => {
                    setConsentBlob(audioBlob);
                    console.log('Consent audio ready:', audioBlob);
                  }}
                  onCompleted={() => {
                    console.log('Consent completed');
                  }}
                  className="mt-4"
                />

                {consentBlob && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2 mt-3">
                    <FileAudio className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 text-sm">Consent recorded successfully</span>
                  </div>
                )}
              </div>
            </div>

            {/* Audio Recording (Required) */}
            <div className="space-y-2">
              <Label>Consultation Audio (Required)</Label>
              <div className="flex items-center space-x-3">
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
                
                {isRecording && (
                  <Button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    variant="outline"
                    className={isPaused ? 'bg-green-50 border-green-300 hover:bg-green-100' : 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'}
                    type="button"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  type="button"
                  disabled={isRecording}
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
              
              {isRecording && (
                <div className={`text-sm flex items-center space-x-2 ${isPaused ? 'text-yellow-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                  <span>{isPaused ? 'Recording paused' : 'Recording in progress...'}</span>
                </div>
              )}


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
