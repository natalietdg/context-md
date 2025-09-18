import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface ProcessingStatusProps {
  consultationId?: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

interface ProcessingUpdate {
  consultationId: string;
  status: string;
  progress?: number;
  message?: string;
  timestamp: string;
}

interface ModelStatus {
  status: 'loading' | 'ready' | 'error';
  details?: any;
  timestamp: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  consultationId,
  onComplete,
  onError,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [processingUpdate, setProcessingUpdate] = useState<ProcessingUpdate | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/consultation`);
    
    newSocket.on('connect', () => {
      console.log('Connected to processing status WebSocket');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from processing status WebSocket');
      setIsConnected(false);
    });

    newSocket.on('processing_update', (data: ProcessingUpdate) => {
      console.log('Processing update:', data);
      if (!consultationId || data.consultationId === consultationId) {
        setProcessingUpdate(data);
      }
    });

    newSocket.on('processing_complete', (data: any) => {
      console.log('Processing complete:', data);
      if (!consultationId || data.consultationId === consultationId) {
        setProcessingUpdate({
          consultationId: data.consultationId,
          status: 'completed',
          progress: 100,
          message: 'Processing completed successfully!',
          timestamp: data.timestamp,
        });
        onComplete?.(data.result);
      }
    });

    newSocket.on('processing_error', (data: any) => {
      console.log('Processing error:', data);
      if (!consultationId || data.consultationId === consultationId) {
        setProcessingUpdate({
          consultationId: data.consultationId,
          status: 'error',
          progress: 0,
          message: `Error: ${data.error}`,
          timestamp: data.timestamp,
        });
        onError?.(data.error);
      }
    });

    newSocket.on('model_status', (data: ModelStatus) => {
      console.log('Model status:', data);
      setModelStatus(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [consultationId, onComplete, onError]);

  const getModelStatusMessage = () => {
    if (!modelStatus) return 'Checking model status...';
    
    switch (modelStatus.status) {
      case 'loading':
        const loadedModels = modelStatus.details ? 
          Object.entries(modelStatus.details)
            .filter(([_, loaded]) => loaded)
            .map(([name, _]) => name) : [];
        return `Loading AI models... (${loadedModels.length}/4 loaded: ${loadedModels.join(', ')})`;
      case 'ready':
        return 'AI models ready for processing';
      case 'error':
        return 'Error loading AI models';
      default:
        return 'Checking model status...';
    }
  };

  const getProgressColor = () => {
    if (processingUpdate?.status === 'error') return 'bg-red-500';
    if (processingUpdate?.status === 'completed') return 'bg-green-500';
    return 'bg-blue-500';
  };

  // Derive status from WebSocket updates and model status
  const status = {
    audioUploaded: processingUpdate?.status === 'processing' || processingUpdate?.status === 'completed',
    transcriptionComplete: processingUpdate?.status === 'completed',
    transcriptionInProgress: processingUpdate?.status === 'processing' && processingUpdate?.message?.includes('transcrib'),
    translationComplete: processingUpdate?.status === 'completed',
    translationInProgress: processingUpdate?.status === 'processing' && processingUpdate?.message?.includes('translat'),
    clinicalComplete: processingUpdate?.status === 'completed',
    clinicalInProgress: processingUpdate?.status === 'processing' && processingUpdate?.message?.includes('clinical'),
    currentStep: processingUpdate?.message || getModelStatusMessage(),
    progress: processingUpdate?.progress
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Processing Status</span>
          {!isConnected && (
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Disconnected" />
          )}
          {isConnected && (
            <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Model loading status */}
        {modelStatus?.status === 'loading' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Loading AI models...</p>
                <p className="text-xs mt-1">{getModelStatusMessage()}</p>
                <p className="text-xs mt-1">This may take 2-5 minutes on first run. Subsequent runs will be much faster.</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Audio Upload</span>
            {status.audioUploaded ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Transcription</span>
            {status.transcriptionComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : status.transcriptionInProgress ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Translation</span>
            {status.translationComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : status.translationInProgress ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Clinical Extraction</span>
            {status.clinicalComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : status.clinicalInProgress ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
        </div>
        
        {status.currentStep && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">{status.currentStep}</p>
            {status.progress && (
              <div className="mt-2">
                <div className="bg-blue-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                <p className="text-xs text-blue-700 mt-1">{status.progress}% complete</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
