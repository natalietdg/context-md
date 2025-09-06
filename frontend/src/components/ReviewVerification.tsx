import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Edit3, Save, AlertTriangle, FileText, ChevronRight, ChevronLeft, Brain, Loader2, CheckCircle2 } from 'lucide-react';

type EditableFieldProps = {
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
  isEditing: boolean;
  isProcessing: boolean;
  tempValue: string;
  onEdit: (field: string) => void;
  onTempChange: (field: string, val: string) => void;
  onSave: (field: string) => void;
  onCancel: () => void;
};

const EditableField = memo(({ field, label, value, multiline = false, isEditing, isProcessing, tempValue, onEdit, onTempChange, onSave, onCancel }: EditableFieldProps) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // place cursor at end
      const len = tempValue?.length ?? 0;
      try {
        (inputRef.current as HTMLInputElement).setSelectionRange?.(len, len);
      } catch {}
    }
  }, [isEditing, tempValue]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-slate-700">{label}</label>
        {!isEditing && !isProcessing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(field)}
            className="h-8 px-2"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea
              ref={inputRef as any}
              value={tempValue || ''}
              onChange={(e) => onTempChange(field, e.target.value)}
              className="min-h-[100px]"
            />
          ) : (
            <input
              ref={inputRef as any}
              type="text"
              value={tempValue || ''}
              onChange={(e) => onTempChange(field, e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <div className="flex space-x-2">
            <Button size="sm" onClick={() => onSave(field)}>
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 rounded-lg border">
          {isProcessing ? (
            <div className="flex items-center space-x-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing with SEA-LION...</span>
            </div>
          ) : (
            <p className="text-slate-700">{value || 'No data available'}</p>
          )}
        </div>
      )}
    </div>
  );
});

export function ReviewVerification({ 
  transcript, 
  summary, 
  setSummary, 
  onNext, 
  onPrevious,
  isProcessingWithSeaLion = false
}: {
  transcript: any;
  summary: any;
  setSummary: any;
  onNext: any;
  onPrevious: any;
  isProcessingWithSeaLion: boolean;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<{ [key: string]: string }>({});

  const medicalTerms = [
    'chest pain', 'sharp pain', 'deep breathing', 'ECG', 'X-ray', 
    'pneumothorax', 'cardiac events', 'consultation', 'ibuprofen', 
    'warfarin', 'lisinopril', 'NSAIDs', '心电图', '胸部X光', 'sakit dada',
    '呼吸困难', 'sesak nafas', 'doktor', '医生', 'pesakit', '病人'
  ];

  const highlightMedicalTerms = (text: string) => {
    let highlightedText = text;
    medicalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      highlightedText = highlightedText.replace(
        regex, 
        `<mark class="bg-yellow-200 px-1 rounded">${term}</mark>`
      );
    });
    return highlightedText;
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleEdit = useCallback((field: string) => {
    setEditingField(field);
    setTempValues((prev) => ({ ...prev, [field]: summary?.[field] ?? '' }));
  }, [summary]);

  const handleSave = useCallback((field: string) => {
    setSummary((prev: any) => ({ ...prev, [field]: tempValues[field] }));
    setEditingField(null);
  }, [tempValues, setSummary]);

  const handleCancel = useCallback(() => {
    setEditingField(null);
    setTempValues({});
  }, []);

  const handleTempChange = useCallback((field: string, val: string) => {
    setTempValues((prev) => ({ ...prev, [field]: val }));
  }, []);

  

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Full Transcript */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Full Consultation Transcript</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-72 md:h-80 lg:h-[43rem] overflow-y-auto bg-slate-50 p-3 sm:p-4 rounded-lg">
              {transcript.map((line: any, index: number) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={
                        line.speaker === 'Doctor' || line.speaker === 'Doktor' || line.speaker === '医生' 
                          ? 'default' 
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {line.speaker}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(new Date())}
                    </span>
                  </div>
                  <p 
                    className="text-slate-700 ml-4"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightMedicalTerms(line.text) 
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - AI Summary Form */}
      <div className="space-y-4">
        {/* SEA-LION Processing Status */}
        {isProcessingWithSeaLion && (
          <Alert className="border-blue-200 bg-blue-50">
            <Brain className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-blue-800">Processing with SEA-LION AI</strong>
                  <p className="text-blue-700 text-sm mt-1">
                    Analyzing transcript for medical insights, entity extraction, and medication conflict detection...
                  </p>
                </div>
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <Progress value={75} className="mt-3 h-2" />
            </AlertDescription>
          </Alert>
        )}

        {/* Display SEA-LION processing error if any */}
        {summary?.error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              <strong>SEA-LION Processing Error:</strong>
              <p className="mt-1">{summary.error}</p>
              <p className="text-sm mt-2">Using fallback analysis. Please review manually.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Show success indicator when SEA-LION processing is complete */}
        {summary && !isProcessingWithSeaLion && !summary?.error && summary.rawSeaLionData && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-green-800">
              <strong>SEA-LION Analysis Complete</strong>
              <p className="text-sm mt-1">
                Medical summary generated successfully. You can edit any fields below before proceeding.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <span>SEA-LION Medical Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <EditableField
              field="symptoms"
              label="Symptoms & Complaints"
              value={summary?.symptoms || ''}
              multiline
              isEditing={editingField === 'symptoms'}
              isProcessing={isProcessingWithSeaLion}
              tempValue={tempValues['symptoms'] || ''}
              onEdit={handleEdit}
              onTempChange={handleTempChange}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            
            <Separator />
            
            <EditableField
              field="treatmentPlan"
              label="Treatment Discussed"
              value={summary?.treatmentPlan || ''}
              multiline
              isEditing={editingField === 'treatmentPlan'}
              isProcessing={isProcessingWithSeaLion}
              tempValue={tempValues['treatmentPlan'] || ''}
              onEdit={handleEdit}
              onTempChange={handleTempChange}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            
            <Separator />
            
            <EditableField
              field="medicalCaveats"
              label="Caveats / Watch For"
              value={summary?.medicalCaveats || ''}
              multiline
              isEditing={editingField === 'medicalCaveats'}
              isProcessing={isProcessingWithSeaLion}
              tempValue={tempValues['medicalCaveats'] || ''}
              onEdit={handleEdit}
              onTempChange={handleTempChange}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            
            <Separator />
            
            <EditableField
              field="potentialMedicationConflicts"
              label="Potential Medication Conflicts"
              value={summary?.potentialMedicationConflicts || ''}
              multiline
              isEditing={editingField === 'potentialMedicationConflicts'}
              isProcessing={isProcessingWithSeaLion}
              tempValue={tempValues['potentialMedicationConflicts'] || ''}
              onEdit={handleEdit}
              onTempChange={handleTempChange}
              onSave={handleSave}
              onCancel={handleCancel}
            />
            
            <Separator />

            {/* Medication Conflicts */}
            <div className="space-y-3">
              <label className="text-sm text-slate-700">Current Medications</label>
              {isProcessingWithSeaLion ? (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing medications and conflicts...</span>
                  </div>
                </div>
              ) : typeof summary?.medicationsPrescribed === 'string' && summary.medicationsPrescribed.trim().length > 0 ? (
                <div className="space-y-2">
                  {summary.medicationsPrescribed
                    .split(/\n|;/)
                    .map((s: string) => s.trim())
                    .filter((s: string) => s.length > 0)
                    .map((name: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-slate-700">{name}</span>
                        <Badge variant="outline" className="text-xs">No Issues</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-4 border rounded-lg text-center text-slate-500">
                  No medications detected in transcript
                </div>
              )}
              
              {/* Conflict Warnings */}
              {typeof summary?.potentialMedicationConflicts === 'string' && summary.potentialMedicationConflicts.trim().length > 0 ? (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-yellow-900">
                    <strong>Potential Medication Conflicts:</strong>
                    <ul className="list-disc list-inside mt-2">
                      {summary.potentialMedicationConflicts
                        .split(/\n|;/)
                        .map((s: string) => s.trim())
                        .filter((s: string) => s.length > 0)
                        .map((text: string, index: number) => (
                          <li key={index}>{text}</li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                summary?.medications?.some((med: any) => med.conflict) && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-red-800">
                      <strong>Medication Conflicts Detected:</strong>
                      <ul className="list-disc list-inside mt-2">
                        {summary.medications
                          .filter((med: any) => med.conflict)
                          .map((med: any, index: number) => (
                            <li key={index}>{med.name}: {med.warning}</li>
                          ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onPrevious} disabled={isProcessingWithSeaLion}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Recording
          </Button>
          <Button 
            onClick={onNext} 
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto sm:min-w-[200px]"
            disabled={isProcessingWithSeaLion}
          >
            {isProcessingWithSeaLion ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Confirm & Lock
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}