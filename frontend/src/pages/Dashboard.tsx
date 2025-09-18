import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  User,
  Stethoscope,
  Phone,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  totalAppointments: number;
  todayAppointments: number;
  completedConsultations: number;
  pendingReports: number;
  criticalAlerts: number;
}

interface UpcomingAppointment {
  appointment: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    notes?: string;
  };
  patient: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    allergies?: string;
  };
  hasHistory: boolean;
  lastConsultation?: string;
  criticalFlags: string[];
}

interface RecentConsultation {
  id: string;
  consultation_date: string;
  patient: {
    id: string;
    name: string;
  };
  processing_status: string;
  reports: any[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<{
    stats: DashboardStats;
    upcomingAppointments: UpcomingAppointment[];
    recentConsultations: RecentConsultation[];
    criticalAlerts: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('[Dashboard] useEffect user =', user);
    if (user?.id) {
      console.log('[Dashboard] calling loadDashboardData for doctorId =', user.id);
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      console.log('[Dashboard] fetching GET /dashboard/doctor');
      const data = await apiService.getDoctorDashboard(user?.id ?? '');
      console.log('[Dashboard] dashboardData received', data);
      setDashboardData(data);
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await apiService.updateAppointmentStatus(appointmentId, status);
      loadDashboardData(); // Refresh data
    } catch (err) {
      console.error('Failed to update appointment status:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProcessingStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDashboardData}>Try Again</Button>
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
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome back, Dr. {user?.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="flex items-center space-x-1">
                <Stethoscope className="h-4 w-4" />
                <span>{user?.department || 'General Medicine'}</span>
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.stats.totalAppointments || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.stats.todayAppointments || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed Consultations</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.stats.completedConsultations || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.stats.pendingReports || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
                  <p className="text-2xl font-bold text-gray-900">{dashboardData?.stats.criticalAlerts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Upcoming Appointments</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.upcomingAppointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No upcoming appointments</p>
                ) : (
                  dashboardData?.upcomingAppointments.map((appointment) => (
                    <div key={appointment.appointment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{appointment.patient.name}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(appointment.appointment.scheduled_at), 'MMM dd, yyyy - h:mm a')}
                          </p>
                        </div>
                        <Badge className={getStatusColor(appointment.appointment.status)}>
                          {appointment.appointment.status}
                        </Badge>
                      </div>
                      
                      {appointment.patient.phone && (
                        <div className="flex items-center space-x-1 text-sm text-gray-600 mb-1">
                          <Phone className="h-4 w-4" />
                          <span>{appointment.patient.phone}</span>
                        </div>
                      )}
                      
                      {appointment.criticalFlags.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center space-x-1 mb-1">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700">Critical Alerts:</span>
                          </div>
                          {appointment.criticalFlags.map((flag, index) => (
                            <Badge key={index} variant="destructive" className="text-xs mr-1 mb-1">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex space-x-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => updateAppointmentStatus(appointment.appointment.id, 'in_progress')}
                          disabled={appointment.appointment.status !== 'scheduled'}
                        >
                          Start Consultation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAppointmentStatus(appointment.appointment.id, 'completed')}
                          disabled={appointment.appointment.status === 'completed'}
                        >
                          Mark Complete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Consultations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Recent Consultations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.recentConsultations.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent consultations</p>
                ) : (
                  dashboardData?.recentConsultations.map((consultation) => (
                    <div key={consultation.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{consultation.patient.name}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(consultation.consultation_date), 'MMM dd, yyyy - h:mm a')}
                          </p>
                        </div>
                        <Badge className={getProcessingStatusColor(consultation.processing_status)}>
                          {consultation.processing_status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm text-gray-600">
                          Reports: {consultation.reports.length}
                        </span>
                        <div className="space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/consultation/${consultation.id}`)}
                          >
                            View Details
                          </Button>
                          {consultation.reports.length === 0 && consultation.processing_status === 'completed' && (
                            <Button 
                              size="sm"
                              onClick={() => navigate(`/consultation/${consultation.id}`)}
                            >
                              Generate Report
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Alerts */}
        {dashboardData?.criticalAlerts && dashboardData.criticalAlerts.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span>Critical Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.criticalAlerts.map((alert, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-red-900">{alert.patient.name}</h4>
                        <p className="text-sm text-red-700">
                          Consultation: {format(new Date(alert.consultation_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </div>
                    
                    {alert.red_flags && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-800">Red Flags:</p>
                        <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                          {Array.isArray(alert.red_flags) ? 
                            alert.red_flags.map((flag: string, i: number) => (
                              <li key={i}>{flag}</li>
                            )) : 
                            <li>{alert.red_flags}</li>
                          }
                        </ul>
                      </div>
                    )}
                    
                    {alert.medication_conflicts && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-800">Medication Conflicts:</p>
                        <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                          {Array.isArray(alert.medication_conflicts) ? 
                            alert.medication_conflicts.map((conflict: string, i: number) => (
                              <li key={i}>{conflict}</li>
                            )) : 
                            <li>{alert.medication_conflicts}</li>
                          }
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
