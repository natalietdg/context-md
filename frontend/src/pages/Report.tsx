import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  User,
  Calendar,
  Languages,
  Pill,
  Activity,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface Report {
  id: string;
  consultation_id: string;
  structured_report: any;
  translated_report?: any;
  target_language?: string;
  generated_at: string;
  updated_at: string;
  consultation: {
    id: string;
    consultation_date: string;
    patient: {
      id: string;
      name: string;
      email: string;
    };
    doctor: {
      id: string;
      name: string;
      department?: string;
    };
  };
}

const Report: React.FC = () => {
  const { id, consultationId } = useParams<{ id?: string; consultationId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('en');

  useEffect(() => {
    if (id) {
      loadReport();
    } else if (consultationId) {
      loadReportByConsultation();
    }
  }, [id, consultationId]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getReport(id!);
      setReport(data);
      setEditedReport(data.structured_report);
      setTargetLanguage(data.target_language || 'en');
    } catch (err: any) {
      setError('Failed to load report');
      console.error('Report error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportByConsultation = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getReportByConsultation(consultationId!);
      setReport(data);
      setEditedReport(data.structured_report);
      setTargetLanguage(data.target_language || 'en');
    } catch (err: any) {
      setError('Failed to load report');
      console.error('Report error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateReport = async () => {
    if (!report) return;

    try {
      setIsRegenerating(true);
      await apiService.regenerateReport(report.id, targetLanguage);
      await (id ? loadReport() : loadReportByConsultation());
    } catch (err: any) {
      setError('Failed to regenerate report');
      console.error('Regenerate error:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const saveReport = async () => {
    if (!report || !editedReport) return;

    try {
      setIsSaving(true);
      await apiService.updateReport(report.id, {
        structured_report: editedReport,
        target_language: targetLanguage
      });
      await (id ? loadReport() : loadReportByConsultation());
      setIsEditing(false);
    } catch (err: any) {
      setError('Failed to save report');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditedReport(report?.structured_report);
    setIsEditing(false);
  };

  const updateReportField = (section: string, field: string, value: any) => {
    setEditedReport((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const downloadReport = () => {
    if (!report) return;

    const reportData = {
      patient: report.consultation.patient,
      doctor: report.consultation.doctor,
      consultation_date: report.consultation.consultation_date,
      report: report.structured_report,
      translated_report: report.translated_report,
      generated_at: report.generated_at
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${report.consultation.patient.name}-${format(new Date(report.consultation.consultation_date), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderReportSection = (title: string, icon: React.ReactNode, section: string, data: any) => {
    if (!data) return null;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {typeof data === 'string' ? (
            isEditing ? (
              <Textarea
                value={editedReport?.[section] || data}
                onChange={(e) => setEditedReport((prev: any) => ({ ...prev, [section]: e.target.value }))}
                className="min-h-32"
              />
            ) : (
              <p className="whitespace-pre-wrap">{data}</p>
            )
          ) : (
            <div className="space-y-3">
              {Object.entries(data).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-600 capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  {isEditing ? (
                    Array.isArray(value) ? (
                      <Textarea
                        value={editedReport?.[section]?.[key]?.join('\n') || (value as string[]).join('\n')}
                        onChange={(e) => updateReportField(section, key, e.target.value.split('\n').filter(Boolean))}
                        className="mt-1"
                        rows={3}
                      />
                    ) : (
                      <Textarea
                        value={editedReport?.[section]?.[key] || value as string}
                        onChange={(e) => updateReportField(section, key, e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    )
                  ) : (
                    <div className="mt-1">
                      {Array.isArray(value) ? (
                        <ul className="list-disc list-inside space-y-1">
                          {(value as string[]).map((item, index) => (
                            <li key={index} className="text-gray-900">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-900 whitespace-pre-wrap">{value as string}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Report</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={id ? loadReport : loadReportByConsultation}>Try Again</Button>
          </CardContent>
        </Card>
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
              <h1 className="text-2xl font-bold text-gray-900">Medical Report</h1>
              <p className="text-gray-600">
                {report && format(new Date(report.consultation.consultation_date), 'MMMM dd, yyyy - h:mm a')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ms">Bahasa</SelectItem>
                  <SelectItem value="ta">தமிழ்</SelectItem>
                </SelectContent>
              </Select>
              
              {isEditing ? (
                <div className="flex space-x-2">
                  <Button onClick={saveReport} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              
              <Button variant="outline" onClick={regenerateReport} disabled={isRegenerating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </Button>
              
              <Button onClick={downloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Report Content */}
          <div className="lg:col-span-3">
            {/* Patient & Doctor Info */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Consultation Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Patient</h4>
                    <p className="text-gray-900">{report?.consultation.patient.name}</p>
                    <p className="text-gray-600 text-sm">{report?.consultation.patient.email}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Doctor</h4>
                    <p className="text-gray-900">{report?.consultation.doctor.name}</p>
                    <p className="text-gray-600 text-sm">{report?.consultation.doctor.department}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Sections */}
            {report?.structured_report && (
              <>
                {renderReportSection(
                  'Chief Complaint & History',
                  <Activity className="h-5 w-5" />,
                  'history',
                  report.structured_report.history
                )}

                {renderReportSection(
                  'Physical Examination',
                  <CheckCircle className="h-5 w-5" />,
                  'examination',
                  report.structured_report.examination
                )}

                {renderReportSection(
                  'Assessment & Diagnosis',
                  <FileText className="h-5 w-5" />,
                  'assessment',
                  report.structured_report.assessment
                )}

                {renderReportSection(
                  'Treatment Plan',
                  <Pill className="h-5 w-5" />,
                  'treatment',
                  report.structured_report.treatment
                )}

                {report.structured_report.red_flags && (
                  <Card className="mb-6 border-red-200">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Red Flags & Alerts</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-red-50 rounded-lg p-4">
                        {Array.isArray(report.structured_report.red_flags) ? (
                          <ul className="list-disc list-inside space-y-1">
                            {report.structured_report.red_flags.map((flag: string, index: number) => (
                              <li key={index} className="text-red-800">{flag}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-red-800">{report.structured_report.red_flags}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {report.structured_report.medication_conflicts && (
                  <Card className="mb-6 border-orange-200">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-orange-700">
                        <Pill className="h-5 w-5" />
                        <span>Medication Conflicts</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-orange-50 rounded-lg p-4">
                        {Array.isArray(report.structured_report.medication_conflicts) ? (
                          <ul className="list-disc list-inside space-y-1">
                            {report.structured_report.medication_conflicts.map((conflict: string, index: number) => (
                              <li key={index} className="text-orange-800">{conflict}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-orange-800">{report.structured_report.medication_conflicts}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Translated Report */}
            {report?.translated_report && report.target_language !== 'en' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Languages className="h-5 w-5" />
                    <span>Translated Report</span>
                    <Badge variant="outline">{report?.target_language?.toUpperCase()}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-gray-900">
                      {JSON.stringify(report?.translated_report, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Report Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Report Info</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Generated</label>
                  <p className="text-gray-900 text-sm">
                    {report && format(new Date(report.generated_at), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900 text-sm">
                    {report && format(new Date(report.updated_at), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Language</label>
                  <p className="text-gray-900 text-sm">
                    {report?.target_language?.toUpperCase() || 'EN'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/consultation/${report?.consultation_id}`)}
                >
                  View Consultation
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/history/patient/${report?.consultation.patient.id}`)}
                >
                  Patient History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
