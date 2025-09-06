import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Lightbulb,
  Clock,
  Mic,
  Brain,
  Shield,
  Globe,
  X,
  CheckCircle2,
  PlayCircle,
  BriefcaseMedicalIcon
} from 'lucide-react';

export function DemoHelper({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const demoSteps = [
    {
      title: "Welcome to ContextMD",
      icon: <Lightbulb className="h-6 w-6" />,
      content: (
        <div className="space-y-4 h-64 sm:h-72 md:h-80 lg:h-[470px]">
          <p className="text-slate-700">
            This demo showcases a complete multilingual medical consultation workflow
            with SEA-LION AI integration.
          </p>
          <div className="bg-green-50 p-3 rounded border border-green-200 text-green-900 text-sm">
            ⚖️ All demo data is local and PDPA-safe (no external storage).
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">🎯 Demo Flow</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>1. Language selection & PDPA consent (45s)</li>
              <li>2. Sample consultation playback (60s)</li>
              <li>3. Live SEA-LION processing (60s)</li>
              <li>4. Final patient handover (60s)</li>
              <li>5. Patient history timeline (30s)</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded">
            <p className="text-sm">
              <strong>Resilience:</strong> Use <strong>Skip Consent</strong> or <strong>Skip Consultation</strong> to fast-forward the demo.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Open this guide anytime via the purple Help icon at the bottom-right or press <strong>H</strong>. Close with the <strong>X</strong>.
          </p>
        </div>
      )
    },
    {
      title: "Step 1: Multilingual Consent & PDPA",
      icon: <Globe className="h-6 w-6" />,
      expectedTime: '⏱️ Expected time: 45s',
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            <strong>Action:</strong> Select different languages to show multilingual support.
          </p>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Badge>🇺🇸 English</Badge>
              <Badge>🇲🇾 Bahasa Malaysia</Badge>
              <Badge>🇨🇳 中文</Badge>
            </div>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Key Features:</strong> PDPA compliance, karaoke-style consent reading,
                automatic verification when script is completed.
                <br />
                <span>
                  Microphone supports <strong>live voice check (speak & verify)</strong>
                  and <strong>auto-read verification (system plays & confirm)</strong> start/stop controls.
                </span>
              </AlertDescription>
            </Alert>
            <div className="bg-slate-50 border border-slate-200 text-slate-800 p-3 rounded">
              <p className="text-sm font-medium">⚙️ Demo Control</p>
              <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
                <li>Auto-Read mode (AI voice reads the consent)</li>
                <li>Live Voice Check mode (you read the consent into the mic)</li>
              </ul>
              <p className="text-sm mt-1">Use <strong>Skip Consent</strong> for fast-forward.</p>
              <p className="text-sm mt-1"><strong>Skip Consultation</strong> will only be enabled after Consent Completed.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Step 2: Pre-recorded Sample Consultation",
      icon: <PlayCircle className="h-6 w-6" />,
      expectedTime: '⏱️ Expected time: 60s',
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            <strong>Action:</strong> Click "Play Sample" to demonstrate audio transcript streaming.
          </p>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-2">📝 What Happens</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Real-time transcript appears line by line</li>
              <li>• Speaker labels (Doctor/Patient) automatically detected</li>
              <li>• Multilingual content synchronized with timing</li>
              {/* <li>• Medical terms highlighted in yellow</li> */}
            </ul>
          </div>
          <div className="bg-slate-50 border border-slate-200 text-slate-800 p-3 rounded">
            <p className="text-sm font-medium">⚙️ Demo Control</p>
            <ul className="text-sm list-disc pl-5 mt-1 space-y-0.5">
              <li>Auto-Read mode (AI voice reads the consultation scripts)</li>
              <li>For demo speed, the transcript is pre-rendered but shown line by line to simulate real-time streaming.</li>
            </ul>
            <p className="text-sm mt-1">Use <strong>Skip Consultation</strong> for fast-forward.</p>
            <p className="text-sm mt-1"><strong>Skip Consultation</strong> will only be enabled after Consent Completed.</p>
          </div>
        </div>
      )
    },
    {
      title: "Step 3: Live SEA-LION AI Processing",
      icon: <Brain className="h-6 w-6" />,
      expectedTime: '⏱️ Expected time: 60s',
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            <strong>Action:</strong> Watch the live SEA-LION API process the transcript.
          </p>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-900 mb-2">🧠 SEA-LION Capabilities</h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Medical summarization (symptoms, treatment, caveats)</li>
              <li>• Entity extraction (medications, conditions, vitals)</li>
              <li>• Medication conflict detection</li>
              <li>• Multilingual translation support</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded">
            <p className="text-sm">
              <strong>Resilience:</strong> If SEA-LION is unavailable, the app <strong>falls back</strong> to local structured analysis to keep the demo flowing.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Step 4: Patient Record Handover",
      icon: <CheckCircle2 className="h-6 w-6" />,
      expectedTime: '⏱️ Expected time: 60s',
      content: (
        <div className="space-y-4">
          <p className="text-slate-700">
            <strong>Action:</strong> Review, edit, and lock the final medical summary.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg border">
            <h4 className="font-medium text-slate-900 mb-2">📋 Final Features</h4>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>• Editable summary fields</li>
              <li>• Medication conflict warnings</li>
              <li>• Email notification simulation</li>
            </ul>
          </div>
          <p className="text-sm text-slate-600">
            When ready, click <strong>Confirm &amp; Lock</strong> to finalize the record. On the completion screen, use <strong>Export</strong> as needed.
          </p>
        </div>
      )
    },
    {
      title: "Step 5: Consultation History",
      icon: <Clock className="h-6 w-6" />,
      expectedTime: '⏱️ Expected time: 30s',
      content: (
        <div className="space-y-4 h-64 sm:h-72 md:h-80 lg:h-[420px]">
          <p className="text-slate-700">
            <strong>Action:</strong> Open <em>Patient History</em> to view continuity.
            <p className='mt-4 text-sm text-slate-600'>Click <Button
            onClick={() => { }}
            className="bg-blue-600 hover:bg-blue-700 shadow-sm z-20 self-end w-fit"
            size="sm"
          >
            <span className="inline-flex items-center">
              <BriefcaseMedicalIcon className="h-3 w-3" />
            </span>
          </Button> to open the medical history modal.</p>
          </p>
          <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
            <h4 className="font-medium text-sky-900 mb-2">🗂 What Stands Out</h4>
            <ul className="text-sm text-sky-800 space-y-1">
              <li>• Timeline of past vs. current consults (contrast)</li>
              <li>• Multilingual summary blocks (EN + selected language)</li>
              <li>• Conflicts badge + alert (credibility in seconds)</li>
            </ul>
          </div>
          <p className="text-sm text-slate-600">Latest record appears first; transcript stays collapsed by default.</p>
        </div>
      )
    },
    // {
    //   title: "Technical Setup & Tips",
    //   icon: <Settings className="h-6 w-6" />,
    //   content: (
    //     <div className="space-y-4">
    //       {/* <Alert className="border-orange-200 bg-orange-50">
    //         <Lightbulb className="h-4 w-4" />
    //         <AlertDescription>
    //           <strong>Before Demo:</strong> Ensure SEA-LION API key is configured in environment variables
    //           for live AI processing. Test each language option beforehand.
    //         </AlertDescription>
    //       </Alert>
    //        */}
    //       <div className="space-y-3">
    //         <h4 className="font-medium">🎬 Presentation Tips</h4>
    //         <ul className="text-sm text-slate-700 space-y-1 ml-4">
    //           <li>• Emphasize the multilingual capabilities (SEA focus)</li>
    //           <li>• Highlight real-time SEA-LION AI integration</li>
    //           <li>• Mention PDPA compliance for healthcare</li>
    //           <li>• Show medication conflict detection</li>
    //           <li>• Demonstrate the complete workflow end-to-end</li>
    //         </ul>
    //       </div>

    //       <div className="bg-red-50 p-3 rounded-lg border border-red-200">
    //         <p className="text-sm text-red-800">
    //           <strong>Fallback:</strong> If SEA-LION API is unavailable, the app gracefully 
    //           falls back to structured analysis while maintaining the demo flow.
    //         </p>
    //       </div>
    //     </div>
    //   )
    // }
  ];

  const currentStepData = demoSteps[currentStep];

  return (
    <div className="demo-overlay">
      <div className="demo-card">
        <Card className="border-0 shadow-none">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  {currentStepData.icon}
                </div>
                <div className="text-left">
                  <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
                  {('expectedTime' in currentStepData) && (
                    <div className="flex items-center text-xs text-slate-600 mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{(currentStepData as any).expectedTime}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-center space-x-2 mt-4">
              {demoSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-8 rounded-full transition-colors ${index === currentStep
                    ? 'bg-blue-500'
                    : index < currentStep
                      ? 'bg-green-500'
                      : 'bg-slate-200'
                    }`}
                />
              ))}
            </div>

            {/* <div className="flex items-center justify-center space-x-2 mt-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-600">
                Step {currentStep + 1} of {demoSteps.length} • 3 min demo
              </span>
            </div> */}
          </CardHeader>

          <CardContent className="pt-0">
            <div className="overflow-y-scroll">

              {currentStepData.content}
            </div>
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                Previous
              </Button>

              {currentStep < demoSteps.length - 1 ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)}>
                  Next Step
                </Button>
              ) : (
                <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
                  Start Demo! 🚀
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}