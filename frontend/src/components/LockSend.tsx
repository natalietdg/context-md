import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, Mail, Database, CheckCircle, Download, Share, ChevronLeft, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { buildEntryFromCurrent } from '../utils/history';

export function LockSend({ transcript, summary, onPrevious }: { transcript: any, summary: any, onPrevious: any}) {
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const mockPatient = {
    name: 'Patient #12345',
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    time: new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    doctor: 'Sarah Chen'
  };

  const handleLockAndSend = async () => {
    setIsSaving(true);
    // Immediately notify app to show history view
    try { window.dispatchEvent(new Event('consultation:lock-started')); } catch {}
    
    // Simulate Firebase save
    setTimeout(() => {
      setSaveComplete(true);
      setIsLocked(true);
      toast.success("Summary saved to secure patient record");
      try {
        const entry = buildEntryFromCurrent({
          doctor: mockPatient.doctor,
          title: summary?.title || 'Consultation Record',
          summary,
          transcript,
        });
        // Notify any listeners (e.g., Patient History timeline)
        window.dispatchEvent(new CustomEvent('consultation:saved', { detail: entry } as any));
      } catch (e) {
        // non-fatal for demo
        console.warn('Failed to build/dispatch consultation entry', e);
      }
      
      // Simulate email send
      setTimeout(() => {
        setEmailSent(true);
        toast.success("Email sent to patient@example.com");
        setIsSaving(false);
      }, 1500);
    }, 2000);
  };

  const handleExport = () => {
    const exportData = {
      patient: mockPatient,
      transcript: transcript,
      summary: summary,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-handover-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Patient record exported successfully");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Cards */}
      {!isLocked && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-center">
              <Lock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm text-amber-800">Ready to Lock</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <Database className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Pending Save</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 text-center">
              <Mail className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Email Pending</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLocked && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-800">Locked & Secured</p>
            </CardContent>
          </Card>
          <Card className={saveComplete ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}>
            <CardContent className="p-4 text-center">
              {saveComplete ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800">Saved to DB</p>
                </>
              ) : (
                <>
                  <Database className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-blue-800">Saving...</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className={emailSent ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}>
            <CardContent className="p-4 text-center">
              {emailSent ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800">Email Sent</p>
                </>
              ) : (
                <>
                  <Mail className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-blue-800">Sending...</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Patient Handover Card */}
      <Card className={isLocked ? "border-green-300 bg-green-50" : "border-slate-200"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Step 3: Patient Handover Card</span>
            </CardTitle>
            {isLocked && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <Lock className="h-3 w-3 mr-1" />
                Locked Record
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Patient Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Patient ID:</span>
                <span className="text-slate-900">{mockPatient.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Date:</span>
                <span className="text-slate-900">{mockPatient.date}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Time:</span>
                <span className="text-slate-900">{mockPatient.time}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">Attending:</span>
                <span className="text-slate-900">{mockPatient.doctor}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary Fields */}
          <div className="space-y-4">
            <div>
              <h4 className="text-slate-900 mb-2">Symptoms & Complaints</h4>
              <div className="p-3 bg-slate-50 rounded-lg border text-slate-700">
                {summary?.symptoms}
              </div>
            </div>

            <div>
              <h4 className="text-slate-900 mb-2">Treatment Discussed</h4>
              <div className="p-3 bg-slate-50 rounded-lg border text-slate-700">
                {summary?.treatmentPlan}
              </div>
            </div>

            <div>
              <h4 className="text-slate-900 mb-2">Caveats / Watch For</h4>
              <div className="p-3 bg-slate-50 rounded-lg border text-slate-700">
                {summary?.medicalCaveats}
              </div>
            </div>

            <div>
              <h4 className="text-slate-900 mb-2">Medications</h4>
              <div className="space-y-2">
                {typeof summary?.medicationsPrescribed === 'string' && summary.medicationsPrescribed.trim().length > 0 ? (
                  summary.medicationsPrescribed
                    .split(/\n|;/)
                    .map((s: string) => s.trim())
                    .filter((s: string) => s.length > 0)
                    .map((name: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <span className="text-slate-700">{name}</span>
                        <Badge variant="outline" className="text-xs">No Issues</Badge>
                      </div>
                    ))
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border text-slate-500 text-center">
                    No medications detected in transcript
                  </div>
                )}
              </div>
            </div>

            {/* Potential Medication Conflicts */}
            {typeof summary?.potentialMedicationConflicts === 'string' && summary.potentialMedicationConflicts.trim().length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
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
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
            {!isLocked ? (
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <Button variant="outline" onClick={onPrevious} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Review
                </Button>
                <Button 
                  onClick={handleLockAndSend}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <>Saving & Sending...</>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Confirm & Lock Record
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <Button onClick={handleExport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Record
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {isLocked && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">
            <strong>Consultation Complete!</strong> The patient record has been securely locked and saved. The patient has been emailed with their medical record. The consultation intelligence system has 
            successfully captured, analyzed, and documented this medical encounter.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}