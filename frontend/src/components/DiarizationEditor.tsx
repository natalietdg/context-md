import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Plus, Edit2, UserCheck, Stethoscope, Trash2 } from 'lucide-react';

interface Segment {
  id: string;
  text: string;
  speaker: string;
  start_time: number;
  end_time: number;
  selected: boolean;
}

interface Speaker {
  id: string;
  name: string;
  color: string;
  segmentCount: number;
  role: 'patient' | 'doctor' | 'unassigned';
}

interface DiarizationEditorProps {
  rawTranscript: string;
  englishTranscript: string;
  diarizationData?: {
    segments: any[];
    speakers: any[];
  };
  onSaveNotes: (selectedSegments: Segment[], editedTranscript: string) => void;
  isProcessing?: boolean;
}

const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
];

export const DiarizationEditor: React.FC<DiarizationEditorProps> = ({
  rawTranscript,
  englishTranscript,
  diarizationData,
  onSaveNotes,
  isProcessing = false
}) => {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string>('all');
  const [editedTranscript, setEditedTranscript] = useState<string>('');
  const [isAddingSpeaker, setIsAddingSpeaker] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  useEffect(() => {
    // Initialize segments and speakers from diarization data
    if (diarizationData?.segments && diarizationData.segments.length > 0) {
      const processedSegments: Segment[] = diarizationData.segments.map((seg, index) => ({
        id: `seg_${index}`,
        text: seg.text || seg.content || '',
        speaker: seg.speaker || `Speaker_${seg.speaker_id || 'Unknown'}`,
        start_time: seg.start || seg.start_time || 0,
        end_time: seg.end || seg.end_time || 0,
        selected: true // All segments selected by default
      }));

      // Extract unique speakers
      const uniqueSpeakers = Array.from(
        new Set(processedSegments.map(seg => seg.speaker))
      );

      const speakerSegments: { [speakerId: string]: number } = {};
      uniqueSpeakers.forEach(speakerId => {
        speakerSegments[speakerId] = processedSegments.filter(seg => seg.speaker === speakerId).length;
      });

      const initialSpeakers = uniqueSpeakers.map((speakerId, index) => ({
        id: speakerId,
        name: speakerId,
        color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
        segmentCount: speakerSegments[speakerId] || 0,
        role: 'unassigned' as const
      }));

      setSegments(processedSegments);
      setSpeakers(initialSpeakers);
      setEditedTranscript(englishTranscript || rawTranscript);
    } else {
      // Fallback: Create single segment from transcript
      const fallbackSegment: Segment = {
        id: 'seg_0',
        text: englishTranscript || rawTranscript,
        speaker: 'Speaker_0',
        start_time: 0,
        end_time: 0,
        selected: true
      };

      setSegments([fallbackSegment]);
      setSpeakers([{
        id: 'Speaker_0',
        name: 'Speaker 1',
        color: SPEAKER_COLORS[0],
        segmentCount: 1,
        role: 'unassigned' as const
      }]);
      setEditedTranscript(englishTranscript || rawTranscript);
    }
  }, [diarizationData, rawTranscript, englishTranscript]);

  const toggleSegmentSelection = (segmentId: string) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, selected: !seg.selected } : seg
    ));
  };

  const toggleAllSpeakerSegments = (speakerId: string, selected: boolean) => {
    setSegments(prev => prev.map(seg => 
      seg.speaker === speakerId ? { ...seg, selected } : seg
    ));
  };

  const getFilteredSegments = (speakerId?: string) => {
    if (!speakerId || speakerId === 'all') {
      return segments;
    }
    return segments.filter(seg => seg.speaker === speakerId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addNewSpeaker = () => {
    if (!newSpeakerName.trim()) return;
    
    const newSpeaker: Speaker = {
      id: `Speaker_${speakers.length}`,
      name: newSpeakerName.trim(),
      color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length],
      segmentCount: 0,
      role: 'unassigned'
    };
    
    setSpeakers(prev => [...prev, newSpeaker]);
    setNewSpeakerName('');
    setIsAddingSpeaker(false);
  };

  const deleteSpeaker = (speakerId: string) => {
    if (speakers.length <= 1) return; // Don't allow deleting the last speaker
    
    // Reassign all segments from deleted speaker to the first remaining speaker
    const remainingSpeakers = speakers.filter(s => s.id !== speakerId);
    const fallbackSpeakerId = remainingSpeakers[0]?.id;
    
    if (fallbackSpeakerId) {
      setSegments(prev => prev.map(seg => 
        seg.speaker === speakerId ? { ...seg, speaker: fallbackSpeakerId } : seg
      ));
    }
    
    // Remove the speaker
    setSpeakers(prev => prev.filter(s => s.id !== speakerId));
    
    // Switch to 'all' tab if we're currently on the deleted speaker's tab
    if (activeSpeaker === speakerId) {
      setActiveSpeaker('all');
    }
  };

  const updateSpeakerRole = (speakerId: string, role: 'patient' | 'doctor') => {
    setSpeakers(prev => prev.map(speaker => {
      if (speaker.id === speakerId) {
        return { ...speaker, role };
      }
      // Auto-assign opposite role to other speakers
      if (speaker.role !== 'unassigned' && speaker.id !== speakerId) {
        return { ...speaker, role: role === 'patient' ? 'doctor' : 'patient' };
      }
      return speaker;
    }));
  };

  const reassignSegmentSpeaker = (segmentId: string, newSpeakerId: string) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, speaker: newSpeakerId } : seg
    ));
    
    // Update speaker segment counts
    setSpeakers(prev => prev.map(speaker => ({
      ...speaker,
      segmentCount: segments.filter(seg => seg.speaker === speaker.id).length
    })));
  };

  const handleGenerateReport = () => {
    const selectedSegments = segments.filter(seg => seg.selected);
    const finalTranscript = selectedSegments.map(seg => seg.text).join(' ');
    setEditedTranscript(finalTranscript);
    onSaveNotes(selectedSegments, finalTranscript);
  };

  const getSelectedCount = (speakerId?: string) => {
    const relevantSegments = getFilteredSegments(speakerId);
    return relevantSegments.filter(seg => seg.selected).length;
  };

  const getTotalCount = (speakerId?: string) => {
    return getFilteredSegments(speakerId).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Review Transcription & Speaker Diarization</span>
            <Button 
              onClick={handleGenerateReport}
              disabled={isProcessing || segments.filter(s => s.selected).length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Processing...' : 'Generate Report'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Review the transcription and select which segments to include in the clinical notes. 
            Use the speaker tabs to focus on specific speakers.
          </p>
          
          {/* Summary Stats */}
          <div className="flex gap-4 mb-4">
            <Badge variant="outline">
              Total Segments: {segments.length}
            </Badge>
            <Badge variant="outline">
              Selected: {segments.filter(s => s.selected).length}
            </Badge>
            <Badge variant="outline">
              Speakers: {speakers.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Speaker Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeSpeaker} onValueChange={setActiveSpeaker}>
            <TabsList className="w-full justify-start p-2 bg-gray-50">
              <TabsTrigger value="all" className="flex items-center gap-2">
                All Speakers
                <Badge variant="secondary" className="text-xs">
                  {getSelectedCount()} / {getTotalCount()}
                </Badge>
              </TabsTrigger>
              {speakers.map((speaker) => (
                <TabsTrigger 
                  key={speaker.id} 
                  value={speaker.id}
                  className="flex items-center gap-2"
                >
                  <span className={`px-2 py-1 rounded text-xs ${speaker.color}`}>
                    {speaker.name}
                  </span>
                  {speaker.role !== 'unassigned' && (
                    speaker.role === 'patient' ? <UserCheck className="h-3 w-3" /> : <Stethoscope className="h-3 w-3" />
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {getSelectedCount(speaker.id)} / {getTotalCount(speaker.id)}
                  </Badge>
                </TabsTrigger>
              ))}
              {speakers.length === 1 && (
                <TabsTrigger value="add-speaker" className="flex items-center gap-2 text-blue-600">
                  <Plus className="h-4 w-4" />
                  Add Speaker
                </TabsTrigger>
              )}
            </TabsList>

            {/* All Speakers Tab */}
            <TabsContent value="all" className="p-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {segments.map((segment) => {
                  const speaker = speakers.find(s => s.id === segment.speaker);
                  return (
                    <div 
                      key={segment.id}
                      className={`p-3 border rounded-lg transition-all ${
                        segment.selected 
                          ? 'bg-white border-gray-200 shadow-sm' 
                          : 'bg-gray-50 border-gray-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={segment.selected}
                          onCheckedChange={(checked: boolean) => toggleSegmentSelection(segment.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${speaker?.color || SPEAKER_COLORS[0]}`}>
                              {speaker?.name || segment.speaker}
                            </span>
                            {segment.start_time > 0 && (
                              <span className="text-xs text-gray-500">
                                {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${segment.selected ? 'text-gray-900' : 'text-gray-500'}`}>
                            {segment.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Add Speaker Tab */}
            <TabsContent value="add-speaker" className="p-4">
              <div className="space-y-4">
                <h3 className="font-medium">Add New Speaker</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Speaker name (e.g., Dr. Smith)"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addNewSpeaker()}
                  />
                  <Button onClick={addNewSpeaker} disabled={!newSpeakerName.trim()}>
                    Add
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Add a second speaker to reassign segments that were incorrectly attributed.
                </p>
              </div>
            </TabsContent>

            {/* Individual Speaker Tabs */}
            {speakers.map((speaker) => (
              <TabsContent key={speaker.id} value={speaker.id} className="p-4">
                <div className="mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <span className={`px-3 py-1 rounded ${speaker.color}`}>
                        {speaker.name}
                      </span>
                      <span className="text-sm text-gray-600">
                        ({speaker.segmentCount} segments)
                      </span>
                    </h3>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllSpeakerSegments(speaker.id, true)}
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleAllSpeakerSegments(speaker.id, false)}
                      >
                        Deselect All
                      </Button>
                      {speakers.length > 1 && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteSpeaker(speaker.id)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Role Assignment */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Role:</span>
                    <div className="flex gap-2">
                      <Button
                        variant={speaker.role === 'patient' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSpeakerRole(speaker.id, 'patient')}
                        className="flex items-center gap-1"
                      >
                        <UserCheck className="h-3 w-3" />
                        Patient
                      </Button>
                      <Button
                        variant={speaker.role === 'doctor' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updateSpeakerRole(speaker.id, 'doctor')}
                        className="flex items-center gap-1"
                      >
                        <Stethoscope className="h-3 w-3" />
                        Doctor
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {getFilteredSegments(speaker.id).map((segment) => (
                    <div 
                      key={segment.id}
                      className={`p-3 border rounded-lg transition-all ${
                        segment.selected 
                          ? 'bg-white border-gray-200 shadow-sm' 
                          : 'bg-gray-50 border-gray-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={segment.selected}
                          onCheckedChange={(checked: boolean) => toggleSegmentSelection(segment.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            {segment.start_time > 0 && (
                              <span className="text-xs text-gray-500">
                                {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
                              </span>
                            )}
                            {speakers.length > 1 && (
                              <select 
                                value={segment.speaker}
                                onChange={(e) => reassignSegmentSpeaker(segment.id, e.target.value)}
                                className="text-xs border rounded px-2 py-1"
                              >
                                {speakers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <p className={`text-sm ${segment.selected ? 'text-gray-900' : 'text-gray-500'}`}>
                            {segment.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Final Transcript Preview */}
      {segments.filter(s => s.selected).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Final Transcript Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
              <p className="text-sm text-gray-800 leading-relaxed">
                {segments.filter(s => s.selected).map(s => s.text).join(' ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DiarizationEditor;
