import React from 'react';
import PatientHistory from './PatientHistory';

// Keep the same named export to avoid breaking imports. Incoming props are ignored.
export function History({ language }: { cases?: any, language?: string }) {
  return (
    <div className="max-w-5xl mx-auto">
      <PatientHistory language={language} />
    </div>
  );
}