import React, { useState, useEffect } from 'react';
import { ConsentRecording } from './components/ConsentRecording';
import { ReviewVerification } from './components/ReviewVerification';
import { LockSend } from './components/LockSend';
import { DemoHelper } from './components/DemoHelper';
import { Progress } from './components/ui/progress';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Stethoscope, HelpCircle, X, BriefcaseMedicalIcon } from 'lucide-react';
import { History } from './components/History';
import { sampleConsultations } from './script-wav/consultations/consultations';
import axios from 'axios';
const publicAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [language, setLanguage] = useState('en');
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [transcript, setTranscript] = useState<any>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [isProcessingWithSeaLion, setIsProcessingWithSeaLion] = useState(false);
  const [showDemoHelper, setShowDemoHelper] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const progressValue = (currentScreen / 3) * 100;

  // Keyboard shortcut to open demo helper (press 'H' key)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const key = (event.key || '').toLowerCase();
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isEditable = !!(
        target && (
          target.isContentEditable ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.getAttribute('role') === 'textbox'
        )
      );
      if (isEditable) return; // don't trigger hotkeys while typing
      if (key === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setShowDemoHelper(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    const onSaved = () => {
      try { setShowHistory(true); } catch {}
    };
    const onLockStarted = () => {
      try { setShowHistory(true); } catch {}
    };
    window.addEventListener('consultation:saved', onSaved as EventListener);
    window.addEventListener('consultation:lock-started', onLockStarted as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('consultation:saved', onSaved as EventListener);
      window.removeEventListener('consultation:lock-started', onLockStarted as EventListener);
    };
  }, []);

  const handleConsentComplete = () => {
    setConsentCompleted(true);
  };

  const handleTranscriptUpdate = (newLine: any) => {
    setTranscript((prev: any) => [...prev, newLine]);
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setTranscript([]);
  };

  const handleRecordingStop = async (finalTranscript: any) => {
    setIsRecording(false);
    setRecordingComplete(true);
    setIsProcessingWithSeaLion(true);

    try {
      // Convert transcript array to string for SEA-LION processing
      const transcriptString = finalTranscript
        .map((line: any) => `${line.speaker}: ${line.text}`)
        .join('\n');

      const response = await axios.post(`${process.env.REACT_APP_SUPABASE_ENDPOINT_URL}/functions/v1/sealion-analysis`, {
        transcript: transcriptString,
        language: language,
        outputLanguage: language // Keep same language for now
      }, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status > 300) {
        const errorData = await response.data?.error;
        throw new Error(errorData || 'Failed to process transcript');
      }

      const result = response.data;

      // Transform SEA-LION response to match existing summary format
      const seaLionSummary: {
        symptoms: string,
        treatmentPlan: string,
        medicalCaveats: string,
        medicationsPrescribed: string,
        potentialMedicationConflicts: string,
        rawSeaLionData: any
      } = {
        symptoms: result.symptoms || 'Processing completed',
        treatmentPlan: result.treatmentPlan || 'Please review consultation notes',
        medicalCaveats: result.medicalCaveats || 'Monitor patient condition',
        medicationsPrescribed: result.medicationsPrescribed || 'Please review consultation notes',
        potentialMedicationConflicts: result.potentialMedicationConflicts || 'Please review consultation notes',
        rawSeaLionData: result // Store full SEA-LION response for debugging
      };

      setSummary(seaLionSummary);
    } catch (error: any) {
      console.error('Error processing with SEA-LION:', error);

      // Fallback to mock summary if SEA-LION fails
      const fallbackSummary: any = {
        symptoms: 'Unable to process with SEA-LION - using fallback analysis',
        treatmentPlan: 'Please review transcript manually for treatment recommendations',
        medicalCaveats: 'Manual review required due to processing error',
        medicationsPrescribed: "",
        potentialMedicationConflicts: "",
        error: error.message
      };
      setSummary(fallbackSummary);
    } finally {
      setIsProcessingWithSeaLion(false);
    }
  };

  const handleNextScreen = () => {
    if (currentScreen < 3) {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handlePreviousScreen = () => {
    if (currentScreen > 1) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  // Skip helpers
  const handleSkipConsent = () => {
    // Mark consent as completed and move to Review screen
    setConsentCompleted(true);
  };

  const handleSkipConsultation = () => {
    // Stop any recording state and move to Review screen
    setTranscript(sampleConsultations[language].transcript)
    handleRecordingStop(sampleConsultations[language].transcript);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-slate-50 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Stethoscope className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl text-slate-900">ContextMD</h1>
                <p className="text-sm text-slate-600"> Multilingual Medical Documentation System</p>
              </div>
            </div>

            {/* Progress Indicator or History State */}
            {showHistory ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border bg-white">
                <BriefcaseMedicalIcon className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-slate-700">Viewing Patient History</span>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600">
                  <span className={currentScreen >= 1 ? 'text-blue-600' : 'text-slate-400'}>1️⃣ Consent</span>
                  <span className="text-slate-300">→</span>
                  <span className={currentScreen >= 2 ? 'text-blue-600' : 'text-slate-400'}>2️⃣ Review</span>
                  <span className="text-slate-300">→</span>
                  <span className={currentScreen >= 3 ? 'text-blue-600' : 'text-slate-400'}>3️⃣ Complete</span>
                </div>
                <div className="w-24 sm:w-32">
                  <Progress value={progressValue} className="h-2" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 py-4 sm:p-6">
        {/* Floating Buttons */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
{/* Patient History */}
<Button
  onClick={() => setShowHistory(true)}
  className="group/history bg-blue-600 hover:bg-blue-700 shadow-lg z-20 self-end w-fit"
  size="lg"
>
  <span className="inline-flex items-center">
    <BriefcaseMedicalIcon className="h-5 w-5" />
    <span
      className="
        inline-block whitespace-nowrap overflow-hidden max-w-0 opacity-0 translate-x-1 ml-0
        transition-all duration-200 ease-out
        group-hover/history:max-w-[160px] group-hover/history:opacity-100
        group-hover/history:translate-x-0 group-hover/history:ml-2
      "
    >
      View History
    </span>
  </span>
</Button>

{/* Demo Guide */}
<Button
  onClick={() => setShowDemoHelper(true)}
  className="group/demo bg-purple-600 hover:bg-purple-700 shadow-lg self-end w-fit"
  size="lg"
>
  <span className="inline-flex items-center">
    <HelpCircle className="h-5 w-5" />
    <span
      className="
        inline-block whitespace-nowrap overflow-hidden max-w-0 opacity-0 translate-x-1 ml-0
        transition-all duration-200 ease-out
        group-hover/demo:max-w-[160px] group-hover/demo:opacity-100
        group-hover/demo:translate-x-0 group-hover/demo:ml-2
      "
    >
      Demo Guide (H)
    </span>
  </span>
</Button>
        </div>

        {/* Skip actions (visible on Consent screen) */}
        {currentScreen === 1 && (
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={handleSkipConsent} aria-label="Skip Consent">Skip Consent</Button>
            <Button variant="secondary" disabled={!consentCompleted} onClick={handleSkipConsultation} aria-label="Skip Consultation">Skip Consultation</Button>
            <Button onClick={() => setShowDemoHelper(true)} className="inline-flex items-center gap-1" aria-label="Open Demo Guide">
              <HelpCircle className="h-4 w-4" />
              <span>Open Demo Guide</span>
            </Button>
          </div>
        )}

        {currentScreen === 1 && (
          <ConsentRecording
            language={language}
            setLanguage={setLanguage}
            consentCompleted={consentCompleted}
            onConsentComplete={handleConsentComplete}
            transcript={transcript}
            isRecording={isRecording}
            onRecordingStart={handleRecordingStart}
            onRecordingStop={handleRecordingStop}
            onTranscriptUpdate={handleTranscriptUpdate}
            onNext={handleNextScreen}
            recordingComplete={recordingComplete}
          />
        )}

        {currentScreen === 2 && (
          <ReviewVerification
            transcript={transcript}
            summary={summary}
            setSummary={setSummary}
            onNext={handleNextScreen}
            onPrevious={handlePreviousScreen}
            isProcessingWithSeaLion={isProcessingWithSeaLion}
          />
        )}

        {currentScreen === 3 && (
          <LockSend
            transcript={transcript}
            summary={summary}
            onPrevious={handlePreviousScreen}
          />
        )}
      </main>

      {/* Demo Helper Modal */}
      {showDemoHelper && (
        <DemoHelper onClose={() => setShowDemoHelper(false)} />
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowHistory(false)} />
          <div className="relative bg-white rounded-lg shadow-xl border max-w-5xl w-[90%] max-h-[85vh] overflow-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between p-3 border-b bg-white">
              <h3 className="text-slate-900">Patient History</h3>
              <button
                className="inline-flex items-center justify-center rounded p-1 hover:bg-slate-100"
                onClick={() => setShowHistory(false)}
                aria-label="Close history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <History language={language} />
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}