import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

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

  const showProcessingStatus = processingUpdate && consultationId;
  const showModelStatus = !consultationId || modelStatus?.status === 'loading';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {showProcessingStatus ? 'Processing Audio' : 'System Status'}
        </h3>
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>

      {/* Model Status */}
      {showModelStatus && (
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              modelStatus?.status === 'ready' ? 'bg-green-400' : 
              modelStatus?.status === 'loading' ? 'bg-yellow-400 animate-pulse' : 
              'bg-red-400'
            }`} />
            <span className="text-sm text-gray-600">AI Models</span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{getModelStatusMessage()}</p>
          
          {modelStatus?.status === 'loading' && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-yellow-400 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </div>
      )}

      {/* Processing Status */}
      {showProcessingStatus && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{processingUpdate.progress || 0}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${processingUpdate.progress || 0}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-600 mb-2">
            {processingUpdate.message || 'Processing...'}
          </p>
          
          <div className="flex items-center">
            {processingUpdate.status === 'processing' && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            )}
            {processingUpdate.status === 'completed' && (
              <div className="text-green-500 mr-2">✓</div>
            )}
            {processingUpdate.status === 'error' && (
              <div className="text-red-500 mr-2">✗</div>
            )}
            <span className="text-xs text-gray-500">
              {new Date(processingUpdate.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* First-time user guidance */}
      {modelStatus?.status === 'loading' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>First-time setup:</strong> AI models are loading in the background. 
            This may take 2-3 minutes on first run, but subsequent processing will be much faster.
          </p>
        </div>
      )}
    </div>
  );
};
