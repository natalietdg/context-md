import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import DiarizationEditor from '../components/DiarizationEditor';

interface Consultation {
  consultation_id: string;
  patient_id: string;
  transcript_raw?: string;
  transcript_eng?: string;
  diarization_data?: string;
  processing_status: string;
  patient: {
    name: string;
    nric: string;
  };
}

interface Segment {
  id: string;
  text: string;
  speaker: string;
  start_time: number;
  end_time: number;
  selected: boolean;
}

const ConsultationProcessing: React.FC = () => {
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();
  
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [isProcessingNotes, setIsProcessingNotes] = useState(false);

  useEffect(() => {
    fetchConsultation();
    
    // Set up WebSocket for real-time updates
    const ws = new WebSocket(`ws://localhost:4000`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.consultationId === consultationId) {
        setProcessingStatus(data.message || '');
        setProgress(data.progress || 0);
        
        if (data.status === 'completed') {
          fetchConsultation(); // Refresh consultation data
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [consultationId]);

  const fetchConsultation = async () => {
    try {
      const response = await fetch(`/api/consultation/${consultationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consultation');
      }

      const data = await response.json();
      setConsultation(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleSaveNotes = async (selectedSegments: Segment[], editedTranscript: string) => {
    if (!consultation) return;

    setIsProcessingNotes(true);
    setError('');

    try {
      // Save the edited diarization data and trigger clinical extraction
      const response = await fetch(`/api/consultation/${consultationId}/save-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          selectedSegments,
          editedTranscript,
          diarizationData: {
            segments: selectedSegments,
            speakers: Array.from(new Set(selectedSegments.map(s => s.speaker)))
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      const result = await response.json();
      
      // Navigate to the report page
      navigate(`/consultation/${consultationId}/report`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
      setIsProcessingNotes(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => navigate('/consultations')}>
                Back to Consultations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Consultation Not Found</h3>
              <p className="text-gray-600 mb-4">The consultation you're looking for doesn't exist.</p>
              <Button onClick={() => navigate('/consultations')}>
                Back to Consultations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const diarizationData = consultation.diarization_data 
    ? JSON.parse(consultation.diarization_data) 
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Consultation Processing</h1>
              <p className="text-gray-600">Patient: {consultation.patient.name} ({consultation.patient.nric})</p>
            </div>
            <div className="flex items-center gap-4">
              {getStatusBadge(consultation.processing_status)}
              <Button 
                variant="outline" 
                onClick={() => navigate('/consultations')}
              >
                Back to Consultations
              </Button>
            </div>
          </div>

          {/* Processing Status */}
          {consultation.processing_status === 'processing' && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{processingStatus || 'Processing audio...'}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{progress}%</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Transcripts */}
        {(consultation.transcript_raw || consultation.transcript_eng) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Raw Transcript */}
            {consultation.transcript_raw && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Raw Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {consultation.transcript_raw}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* English Transcript */}
            {consultation.transcript_eng && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">English Translation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {consultation.transcript_eng}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Diarization Editor */}
        {consultation.processing_status === 'completed' && (consultation.transcript_raw || consultation.transcript_eng) && (
          <DiarizationEditor
            rawTranscript={consultation.transcript_raw || ''}
            englishTranscript={consultation.transcript_eng || ''}
            diarizationData={diarizationData}
            onSaveNotes={handleSaveNotes}
            isProcessing={isProcessingNotes}
          />
        )}

        {/* Processing Instructions */}
        {consultation.processing_status === 'processing' && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Your Consultation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Your consultation audio is being processed through our AI pipeline:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Transcribing audio with speaker diarization</li>
                  <li>Translating to English (if needed)</li>
                  <li>Preparing for clinical information extraction</li>
                </ol>
                <p className="text-sm text-gray-500">
                  This usually takes 2-5 minutes for the first processing as AI models need to load.
                  Subsequent processing will be much faster.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ConsultationProcessing;
