import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertTriangle, Send, Mic, Upload } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export function CaseInput({ onSubmit }: { onSubmit: (caseText: string) => void }) {
  const [caseText, setCaseText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!caseText.trim()) return;
    
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
    onSubmit(caseText);
    setIsProcessing(false);
  };

  const handleQuickInsert = (template: any) => {
    setCaseText(template);
  };

  const templates = [
    {
      name: 'Chest Pain',
      content: 'Patient presents with acute onset chest pain. Pain described as crushing, radiating to left arm. Associated with diaphoresis and nausea. Vital signs: BP 140/90, HR 95, RR 18, O2 sat 98% on room air. No prior cardiac history.'
    },
    {
      name: 'Respiratory',
      content: 'Patient complains of progressive shortness of breath over 3 days. Associated with productive cough, yellow sputum. Fever 38.5°C. Bilateral crackles on auscultation. CXR shows bilateral infiltrates.'
    },
    {
      name: 'Abdominal Pain',
      content: 'Patient with acute RLQ abdominal pain, nausea, and vomiting. Pain started periumbilical then migrated to RLQ. Positive McBurney\'s point tenderness. WBC 15,000. Temperature 38.2°C.'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Input Area */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Patient Case Input</CardTitle>
            <CardDescription>
              Enter patient notes, symptoms, lab results, or any clinical information for AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter patient case details here...

Example:
- Chief complaint and history of present illness
- Physical examination findings
- Vital signs and laboratory results
- Current medications and allergies
- Assessment and plan"
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              className="min-h-[300px] resize-none"
            />
            
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!caseText.trim() || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Analyze Case
                  </>
                )}
              </Button>
              
              <Button variant="outline" className="border-slate-300">
                <Mic className="h-4 w-4 mr-2" />
                Voice Input
              </Button>
              
              <Button variant="outline" className="border-slate-300">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Privacy Notice:</strong> Do not include patient identifiers (names, DOB, SSN, etc.). 
                Use anonymized data only.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Quick Templates */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Quick Templates</CardTitle>
            <CardDescription>
              Common case templates to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template, index) => (
              <div key={index} className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-300"
                  onClick={() => handleQuickInsert(template.content)}
                >
                  {template.name}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-900">Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2">
              <Badge variant="outline" className="w-full justify-start">
                Include vital signs
              </Badge>
              <Badge variant="outline" className="w-full justify-start">
                Note red flag symptoms
              </Badge>
              <Badge variant="outline" className="w-full justify-start">
                Mention relevant history
              </Badge>
              <Badge variant="outline" className="w-full justify-start">
                Add lab/imaging results
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}