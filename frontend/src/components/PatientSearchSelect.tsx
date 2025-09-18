import React, { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Search, Check } from 'lucide-react';

export interface Patient {
  id: string;
  name: string;
  nric: string;
  email: string;
  phone?: string;
}

interface PatientSearchSelectProps {
  value: string;
  onChange: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
  isLoading: boolean;
  patients: Patient[];
}

const PatientSearchSelect: React.FC<PatientSearchSelectProps> = ({
  value,
  onChange,
  search,
  onSearch,
  isLoading,
  patients,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPatientData = patients.find(p => p.id === value);

  useEffect(() => {
    if (selectedPatientData) {
      setSelectedPatient(selectedPatientData);
    }
  }, [selectedPatientData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePatientSelect = (patient: Patient) => {
    onChange(patient.id);
    setSelectedPatient(patient);
    onSearch(patient.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    onSearch(searchValue);
    setIsOpen(true);
    
    // Clear selection if search doesn't match selected patient
    if (selectedPatient && !selectedPatient.name.toLowerCase().includes(searchValue.toLowerCase())) {
      onChange('');
      setSelectedPatient(null);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor="patient-search">Select Patient</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          id="patient-search"
          placeholder="Search patients by name, NRIC, or email..."
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
        {selectedPatient && (
          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading patients...</div>
            ) : patients.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No patients found</div>
            ) : (
              patients.map((patient) => (
                <div
                  key={patient.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    value === patient.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handlePatientSelect(patient)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{patient.name}</span>
                    <span className="text-sm text-gray-500">
                      {patient.nric} • {patient.email}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSearchSelect;
