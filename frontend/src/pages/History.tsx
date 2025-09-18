import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  Search, 
  User, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  Clock,
  Pill,
  Activity,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

interface PatientHistory {
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    allergies?: string;
    date_of_birth?: string;
  };
  consultations: Array<{
    id: string;
    consultation_date: string;
    doctor: {
      id: string;
      name: string;
      department?: string;
    };
    processing_status: string;
    notes?: string;
    reports: Array<{
      id: string;
      structured_report: any;
      generated_at: string;
    }>;
  }>;
  totalConsultations: number;
  recentActivity: string;
  criticalFlags: string[];
  medicationHistory: string[];
}

interface HandoverSummary {
  patient: {
    id: string;
    name: string;
    email: string;
  };
  recentConsultations: Array<{
    id: string;
    consultation_date: string;
    doctor: {
      name: string;
      department?: string;
    };
    key_findings: string[];
    medications: string[];
    follow_up: string[];
  }>;
  criticalAlerts: string[];
  medicationConflicts: string[];
  continuityNotes: string;
  handoverPriority: 'low' | 'medium' | 'high' | 'critical';
}

const History: React.FC = () => {
  const { patientId } = useParams<{ patientId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [patientHistory, setPatientHistory] = useState<PatientHistory | null>(null);
  const [handoverSummary, setHandoverSummary] = useState<HandoverSummary | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'handover'>('history');

  useEffect(() => {
    if (patientId) {
      loadPatientData();
    } else {
      loadPatientsList();
    }
  }, [patientId]);

  const loadPatientsList = async () => {
    try {
      setIsLoading(true);
      setError(''); // Clear any previous errors
      const patientsData = await apiService.getPatients();
      setPatients(patientsData || []);
    } catch (err: any) {
      console.error('Patients list error:', err);
      // If it's a 404 or no patients, don't show as error
      if (err.response?.status === 404 || err.message?.includes('No patients')) {
        setPatients([]);
        setError('');
      } else {
        setError(`Failed to load patients list: ${err.response?.data?.message || err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatientData = async () => {
    try {
      setIsLoading(true);
      const [historyData, handoverData] = await Promise.all([
        apiService.getPatientHistory(patientId!),
        apiService.getHandoverSummary(patientId!)
      ]);
      
      setPatientHistory(historyData);
      setHandoverSummary(handoverData);
    } catch (err: any) {
      setError('Failed to load patient data');
      console.error('History error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || !patientId) return;

    try {
      setIsSearching(true);
      const results = await apiService.searchPatientHistory(patientId, searchTerm);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadHistory = () => {
    if (!patientHistory) return;

    const historyData = {
      patient: patientHistory.patient,
      consultations: patientHistory.consultations,
      handover_summary: handoverSummary,
      exported_at: new Date().toISOString(),
      exported_by: user?.name
    };

    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-history-${patientHistory.patient.name}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading patient history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading History</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={patientId ? loadPatientData : loadPatientsList}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no patient ID, show patient list
  if (!patientId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Patient History</h1>
                <p className="text-gray-600">Select a patient to view their medical history</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search patients by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={() => {}}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Patients List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Patients</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patients.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No patients found</p>
                ) : (
                  patients
                    .filter(patient => 
                      !searchTerm || 
                      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      patient.email.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((patient) => (
                      <div key={patient.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-900">{patient.name}</h4>
                            <p className="text-gray-600 text-sm">{patient.email}</p>
                            {patient.phone && (
                              <p className="text-gray-500 text-sm">{patient.phone}</p>
                            )}
                          </div>
                          <Button
                            onClick={() => navigate(`/history/patient/${patient.id}`)}
                            className="flex items-center space-x-2"
                          >
                            <span>View History</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patient History</h1>
              <p className="text-gray-600">{patientHistory?.patient.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Full History
                </button>
                <button
                  onClick={() => setActiveTab('handover')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'handover'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Handover Summary
                </button>
              </div>
              <Button onClick={downloadHistory}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Patient Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-gray-900 font-medium">{patientHistory?.patient.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-gray-900">{patientHistory?.patient.email}</p>
              </div>
              {patientHistory?.patient.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p className="text-gray-900">{patientHistory.patient.phone}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">Total Consultations</label>
                <p className="text-gray-900 font-medium">{patientHistory?.totalConsultations || 0}</p>
              </div>
            </div>
            
            {patientHistory?.patient.allergies && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Allergies</span>
                </div>
                <p className="text-red-700 mt-1">{patientHistory.patient.allergies}</p>
              </div>
            )}

            {patientHistory?.criticalFlags && patientHistory.criticalFlags.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-800">Critical Flags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patientHistory.criticalFlags.map((flag, index) => (
                    <Badge key={index} variant="destructive" className="text-xs">
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search patient history (symptoms, medications, diagnoses...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-gray-900">Search Results</h4>
                {searchResults.map((result, index) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-900 font-medium">{result.type}</p>
                        <p className="text-blue-800 text-sm">{result.content}</p>
                        <p className="text-blue-600 text-xs">
                          {format(new Date(result.date), 'MMM dd, yyyy')} - Dr. {result.doctor}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/consultation/${result.consultation_id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Consultation History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Consultation History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {patientHistory?.consultations.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No consultations found</p>
                  ) : (
                    patientHistory?.consultations.map((consultation) => (
                      <div key={consultation.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {consultation.consultation_date ? format(new Date(consultation.consultation_date), 'MMMM dd, yyyy - h:mm a') : 'Invalid Date'}
                            </h4>
                            <p className="text-gray-600 text-sm">
                              Dr. {consultation.doctor.name} • {consultation.doctor.department}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(consultation.processing_status)}>
                              {consultation.processing_status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/consultation/${consultation.id}`)}
                            >
                              View Details
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>

                        {consultation.notes && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">
                              {consultation.notes}
                            </p>
                          </div>
                        )}

                        {consultation.reports.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-gray-700">Reports ({consultation.reports.length})</h5>
                            {consultation.reports.map((report) => (
                              <div key={report.id} className="bg-blue-50 border border-blue-200 rounded p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    {report.structured_report?.assessment?.primary_diagnosis && (
                                      <p className="text-blue-900 font-medium text-sm">
                                        {report.structured_report.assessment.primary_diagnosis}
                                      </p>
                                    )}
                                    <p className="text-blue-700 text-xs">
                                      Generated: {format(new Date(report.generated_at), 'MMM dd, yyyy h:mm a')}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/report/${report.id}`)}
                                  >
                                    <FileText className="h-4 w-4 mr-1" />
                                    View Report
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Medication History */}
            {patientHistory?.medicationHistory && patientHistory.medicationHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Pill className="h-5 w-5" />
                    <span>Medication History</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {patientHistory.medicationHistory.map((medication, index) => (
                      <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-900 font-medium text-sm">{medication}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'handover' && handoverSummary && (
          <div className="space-y-6">
            {/* Handover Priority */}
            <Card className={`border-2 ${getPriorityColor(handoverSummary.handoverPriority)}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Handover Summary</span>
                  </div>
                  <Badge className={getPriorityColor(handoverSummary.handoverPriority)}>
                    {handoverSummary.handoverPriority.toUpperCase()} PRIORITY
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {handoverSummary.continuityNotes}
                </p>
              </CardContent>
            </Card>

            {/* Critical Alerts */}
            {handoverSummary.criticalAlerts.length > 0 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Critical Alerts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {handoverSummary.criticalAlerts.map((alert, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-red-800">{alert}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Medication Conflicts */}
            {handoverSummary.medicationConflicts.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-orange-700">
                    <Pill className="h-5 w-5" />
                    <span>Medication Conflicts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {handoverSummary.medicationConflicts.map((conflict, index) => (
                      <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-orange-800">{conflict}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Consultations Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Recent Consultations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {handoverSummary.recentConsultations.map((consultation, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {consultation.consultation_date ? format(new Date(consultation.consultation_date), 'MMM dd, yyyy') : 'Invalid Date'}
                          </h4>
                          <p className="text-gray-600 text-sm">
                            Dr. {consultation.doctor.name} • {consultation.doctor.department}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {consultation.key_findings.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Key Findings</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {consultation.key_findings.map((finding, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                  {finding}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {consultation.medications.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Medications</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {consultation.medications.map((medication, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="w-1 h-1 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                  {medication}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {consultation.follow_up.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Follow-up</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {consultation.follow_up.map((item, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="w-1 h-1 bg-green-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
