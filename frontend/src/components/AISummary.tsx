import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, CheckCircle, FileText, Download, Share, Clock } from 'lucide-react';

export function AISummary({ summary, currentCase }: { summary: any; currentCase: any }) {
  if (!summary) {
    return (
      <div className="text-center py-12">
        <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-slate-900 mb-2">No Case Analysis Yet</h3>
        <p className="text-slate-600">Submit a case in the Case Input tab to see AI analysis results here.</p>
      </div>
    );
  }

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      case: currentCase,
      analysis: summary
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contextmd-case-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h2 className="text-slate-900">Analysis Complete</h2>
            <p className="text-sm text-slate-600 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {formatTimestamp(summary.timestamp)}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExport} className="border-slate-300">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="border-slate-300">
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Red Flags */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Critical Red Flags
            </CardTitle>
            <CardDescription>
              Urgent findings requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.redFlags.map((flag: string, index: number) => (
              <Alert key={index} className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  {flag}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>

        {/* Key Findings */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700">
              <CheckCircle className="h-5 w-5 mr-2" />
              Key Findings
            </CardTitle>
            <CardDescription>
              Important clinical observations and assessments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.keyFindings.map((finding: string, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-slate-700">{finding}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic Suggestions */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <FileText className="h-5 w-5 mr-2" />
            Suggested Next Steps
          </CardTitle>
          <CardDescription>
            Recommended diagnostic workup and considerations (not definitive diagnosis)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.suggestions.map((suggestion: string, index: number) => (
              <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">{index + 1}</span>
                  </div>
                  <p className="text-green-800">{suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-amber-800">
          <strong>Medical Disclaimer:</strong> This AI analysis is for educational and reference purposes only. 
          Always rely on clinical judgment and follow institutional protocols. Do not use as a substitute for 
          professional medical diagnosis or treatment decisions.
        </AlertDescription>
      </Alert>
    </div>
  );
}