import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { 
  Mic, 
  MicOff, 
  Upload, 
  FileAudio, 
  Clock, 
  User, 
  AlertCircle,
  CheckCircle,
  Lock,
  Unlock,
  Play,
  Pause,
  Download,
  Shield,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { LiveConsentKaraoke } from '../components/LiveConsentKaraoke';

interface Consultation {
  id: string;
  consultation_date: string;
  aws_audio_link?: string;
  transcript_raw?: string;
  transcript_eng?: string;
  file_size?: number;
  processing_status: string;
  is_locked: boolean;
  notes?: string;
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    allergies?: string;
  };
  doctor: {
    id: string;
    name: string;
    department?: string;
  };
  consent?: {
    id: string;
    status: string;
    aws_audio_link?: string;
    consent_text?: string;
    duration_seconds?: number;
    created_at?: string;
  };
  reports: any[];
}

const Consultation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);
  const [consentAudioUrl, setConsentAudioUrl] = useState<string | null>(null);
  const [isPlayingConsent, setIsPlayingConsent] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (id) {
      loadConsultation();
    }
  }, [id]);

  // Early return if no ID is provided
  if (!id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Consultation ID</h3>
            <p className="text-gray-600 mb-4">Please provide a valid consultation ID to view this page.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    if (consultation) {
      setNotes(consultation.notes || '');
    }
  }, [consultation]);

  const loadConsultation = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getConsultation(id!);
      setConsultation(data);
    } catch (err: any) {
      setError('Failed to load consultation');
      console.error('Consultation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioBlob(file);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob || !consultation) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'consultation-audio.wav');

      await apiService.uploadConsultationAudio(
        consultation.id,
        formData,
        (percent) => setUploadProgress(percent)
      );
      
      // Reload consultation data
      await loadConsultation();
      setAudioBlob(null);
      
    } catch (err: any) {
      setError('Failed to upload audio');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const updateNotes = async () => {
    if (!consultation) return;

    try {
      setIsUpdatingNotes(true);
      await apiService.updateConsultation(consultation.id, { notes });
      await loadConsultation();
    } catch (err) {
      setError('Failed to update notes');
      console.error('Notes update error:', err);
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  const toggleLock = async () => {
    if (!consultation) return;

    try {
      await apiService.lockConsultation({
        consultation_id: consultation.id,
        lock: !consultation.is_locked
      });
      await loadConsultation();
    } catch (err) {
      setError('Failed to update lock status');
      console.error('Lock error:', err);
    }
  };

  const generateReport = async () => {
    if (!consultation) return;

    try {
      await apiService.generateReport({
        consultation_id: consultation.id,
        target_language: 'en'
      });
      navigate(`/report/consultation/${consultation.id}`);
    } catch (err) {
      setError('Failed to generate report');
      console.error('Report generation error:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (error && !consultation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Consultation</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadConsultation}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consultation</h1>
              <p className="text-gray-600">
                {consultation && format(new Date(consultation.consultation_date), 'MMMM dd, yyyy - h:mm a')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge className={getStatusColor(consultation?.processing_status || 'pending')}>
                {consultation?.processing_status || 'pending'}
              </Badge>
              {consultation?.is_locked ? (
                <Badge variant="destructive" className="flex items-center space-x-1">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Unlock className="h-3 w-3" />
                  <span>Unlocked</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Patient Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{consultation?.patient.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{consultation?.patient.email}</p>
                  </div>
                  {consultation?.patient.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-gray-900">{consultation.patient.phone}</p>
                    </div>
                  )}
                  {consultation?.patient.allergies && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Allergies</label>
                      <p className="text-red-700 font-medium">{consultation.patient.allergies}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Consent Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Patient Consent
                </CardTitle>
              </CardHeader>
              <CardContent>
                {consultation?.consent ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-green-800">Consent recorded</span>
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          {consultation.consent?.status}
                        </Badge>
                      </div>
                      {consultation.consent?.aws_audio_link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              if (isPlayingConsent && audioRef.current) {
                                audioRef.current.pause();
                                setIsPlayingConsent(false);
                                return;
                              }
                              
                              const res = await apiService.replayConsent({
                                consent_id: consultation.consent?.id || '',
                                role: 'doctor',
                                purpose: 'consultation_review'
                              });
                              if (res?.signedUrl) {
                                setConsentAudioUrl(res.signedUrl);
                                setIsPlayingConsent(true);
                              }
                            } catch (e) {
                              setError('Failed to replay consent');
                            }
                          }}
                        >
                          {isPlayingConsent ? (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Pause Consent
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Replay Consent
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {consultation.consent?.consent_text && (
                      <div className="bg-gray-50 border rounded-lg p-3">
                        <p className="text-sm text-gray-700">{consultation.consent?.consent_text}</p>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500">
                      Recorded: {format(new Date(consultation.consent?.created_at || consultation.consultation_date), 'MMM dd, yyyy - h:mm a')}
                      {consultation.consent?.duration_seconds && (
                        <span className="ml-2">• Duration: {Math.floor(consultation.consent?.duration_seconds / 60)}:{(consultation.consent?.duration_seconds % 60).toString().padStart(2, '0')}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span>No consent recorded for this consultation</span>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800 mb-3">
                        Patient consent is required before proceeding with the consultation recording.
                      </p>
                      
                      <LiveConsentKaraoke
                        words={[
                          "I", "consent", "to", "the", "recording", "and", "processing", 
                          "of", "my", "voice", "for", "medical", "documentation", "purposes"
                        ]}
                        lines={[
                          "I consent to the recording and processing of my voice for medical documentation purposes."
                        ]}
                        language="en-US"
                        sentenceMode={true}
                        sentenceThreshold={0.7}
                        ignoreBracketed={true}
                        requirePDPAKeyword={false}
                        onCompleted={() => {
                          console.log('Consent completed');
                          // TODO: Save consent to backend
                        }}
                        className="mt-4"
                      />
                      </div>
                    </div>
                  )}
                  
                  {/* Inline Audio Player */}
                  {consentAudioUrl && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 mb-2">Consent Audio Playback</p>
                          <audio
                            ref={audioRef}
                            src={consentAudioUrl}
                            controls
                            className="w-full"
                            onPlay={() => setIsPlayingConsent(true)}
                            onPause={() => setIsPlayingConsent(false)}
                            onEnded={() => {
                              setIsPlayingConsent(false);
                              setConsentAudioUrl(null);
                            }}
                            autoPlay
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.pause();
                            }
                            setConsentAudioUrl(null);
                            setIsPlayingConsent(false);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            
            {/* Audio Recording */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mic className="h-5 w-5 mr-2" />
                  Audio Recording
                </CardTitle>
              </CardHeader>
                <CardContent>
                {consultation?.processing_status === 'pending' ? (
                  <div className="space-y-4">
                    {/* Recording Controls */}
                    <div className="flex items-center space-x-4">
                      <Button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={isRecording ? 'bg-red-600 hover:bg-red-700' : ''}
                        disabled={isUploading}
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
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
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

                    {/* Audio Preview */}
                    {audioBlob && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileAudio className="h-5 w-5 text-blue-600" />
                            <span className="text-blue-800">Audio ready for upload</span>
                          </div>
                          <Button onClick={uploadAudio} disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Upload Audio'}
                          </Button>
                        </div>
                        
                        {isUploading && (
                          <div className="mt-3">
                            <div className="bg-blue-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-sm text-blue-700 mt-1">{uploadProgress}% uploaded</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>Audio processing completed</p>
                  </div>
                )}

                {consultation?.aws_audio_link && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-800">Audio uploaded successfully</span>
                    </div>
                    {typeof consultation.file_size === 'number' && (
                      <p className="text-xs text-green-700 mt-2">
                        File size: {Math.round((consultation.file_size / (1024 * 1024)) * 100) / 100} MB
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transcripts */}
            <Card>
              <CardHeader>
                <CardTitle>Transcripts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Raw Transcript Section */}
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block flex items-center">
                    Raw Transcript
                    {!consultation?.transcript_raw && consultation?.processing_status === 'processing' && (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin text-blue-500" />
                    )}
                  </label>
                  {consultation?.transcript_raw ? (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {consultation.transcript_raw}
                      </p>
                    </div>
                  ) : consultation?.processing_status === 'processing' ? (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center min-h-24">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm">Transcribing audio...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center min-h-24">
                      <p className="text-gray-500 text-sm">Transcription not available</p>
                    </div>
                  )}
                </div>
                
                {/* English Translation Section */}
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block flex items-center">
                    English Translation
                    {!consultation?.transcript_eng && consultation?.transcript_raw && consultation?.processing_status === 'processing' && (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin text-green-500" />
                    )}
                  </label>
                  {consultation?.transcript_eng ? (
                    <div className="bg-blue-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {consultation.transcript_eng}
                      </p>
                    </div>
                  ) : consultation?.transcript_raw && consultation?.processing_status === 'processing' ? (
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center min-h-24">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-green-500 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm">Translating to English...</p>
                      </div>
                    </div>
                  ) : consultation?.transcript_raw ? (
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center min-h-24">
                      <p className="text-gray-500 text-sm">Translation pending</p>
                    </div>
                  ) : (
                    <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-center min-h-24">
                      <p className="text-gray-500 text-sm">Awaiting transcription</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add clinical notes, observations, or additional details..."
                  className="min-h-32"
                  disabled={consultation?.is_locked}
                />
                {!consultation?.is_locked && (
                  <div className="flex justify-end mt-4">
                    <Button 
                      onClick={updateNotes}
                      disabled={isUpdatingNotes || notes === consultation?.notes}
                    >
                      {isUpdatingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={toggleLock}
                  variant={consultation?.is_locked ? "destructive" : "outline"}
                  className="w-full"
                >
                  {consultation?.is_locked ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Unlock Consultation
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Lock Consultation
                    </>
                  )}
                </Button>

                <Button
                  onClick={generateReport}
                  className="w-full"
                  disabled={consultation?.processing_status !== 'completed'}
                >
                  Generate Report
                </Button>

                {consultation?.reports && consultation.reports.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/report/consultation/${consultation.id}`)}
                  >
                    View Reports ({consultation.reports.length})
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Processing Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Processing Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Audio Upload</span>
                    {consultation?.aws_audio_link ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Transcription</span>
                    {consultation?.transcript_raw ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : consultation?.processing_status === 'processing' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Translation</span>
                    {consultation?.transcript_eng ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : consultation?.processing_status === 'processing' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consent Information */}
            <Card>
              <CardHeader>
                <CardTitle>Consent Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge className={consultation?.consent?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {consultation?.consent?.status}
                  </Badge>
                </div>
                {consultation?.consent?.aws_audio_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await apiService.replayConsent({
                          consent_id: consultation.consent?.id || '',
                          role: 'doctor',
                          purpose: 'consultation_review'
                        });
                        if (res?.signedUrl) {
                          setConsentAudioUrl(res.signedUrl);
                          setIsPlayingConsent(true);
                        }
                      } catch (e) {
                        setError('Failed to replay consent');
                      }
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Replay Consent
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Consultation;
