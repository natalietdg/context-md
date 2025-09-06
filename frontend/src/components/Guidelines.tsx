import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BookOpen, Search, ExternalLink, Star, Clock } from 'lucide-react';

export function Guidelines({ currentCase }: { currentCase: string }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Mock guidelines data
  const guidelines = {
    who: [
      {
        id: 1,
        title: 'Management of Acute Coronary Syndrome',
        organization: 'WHO',
        category: 'Cardiology',
        summary: 'Evidence-based guidelines for diagnosis and management of ACS including STEMI and NSTEMI.',
        relevantKeywords: ['chest pain', 'coronary', 'cardiac', 'troponin'],
        lastUpdated: '2024-01-15',
        link: '#'
      },
      {
        id: 2,
        title: 'Sepsis Recognition and Management',
        organization: 'WHO',
        category: 'Emergency Medicine',
        summary: 'Early recognition and treatment protocols for sepsis and septic shock.',
        relevantKeywords: ['fever', 'infection', 'sepsis', 'shock'],
        lastUpdated: '2023-11-20',
        link: '#'
      }
    ],
    cdc: [
      {
        id: 3,
        title: 'Pneumonia Treatment Guidelines',
        organization: 'CDC',
        category: 'Pulmonology',
        summary: 'Community-acquired and healthcare-associated pneumonia management protocols.',
        relevantKeywords: ['pneumonia', 'cough', 'respiratory', 'chest xray'],
        lastUpdated: '2024-02-10',
        link: '#'
      },
      {
        id: 4,
        title: 'Antibiotic Stewardship Guidelines',
        organization: 'CDC',
        category: 'Infectious Disease',
        summary: 'Best practices for appropriate antibiotic use and resistance prevention.',
        relevantKeywords: ['antibiotic', 'infection', 'resistance', 'stewardship'],
        lastUpdated: '2024-01-05',
        link: '#'
      }
    ],
    nice: [
      {
        id: 5,
        title: 'Acute Abdominal Pain Assessment',
        organization: 'NICE',
        category: 'Emergency Medicine',
        summary: 'Clinical pathways for evaluation of acute abdominal pain in adults.',
        relevantKeywords: ['abdominal pain', 'appendicitis', 'bowel', 'nausea'],
        lastUpdated: '2023-12-18',
        link: '#'
      },
      {
        id: 6,
        title: 'Mental Health Crisis Intervention',
        organization: 'NICE',
        category: 'Psychiatry',
        summary: 'Guidelines for managing acute mental health presentations in emergency settings.',
        relevantKeywords: ['mental health', 'crisis', 'psychiatry', 'suicide'],
        lastUpdated: '2024-01-30',
        link: '#'
      }
    ]
  };

  // Get relevant guidelines based on current case
  const getRelevantGuidelines = () => {
    if (!currentCase) return [];
    
    const caseText = currentCase.toLowerCase();
    const allGuidelines = [...guidelines.who, ...guidelines.cdc, ...guidelines.nice];
    
    return allGuidelines.filter(guideline => 
      guideline.relevantKeywords.some(keyword => 
        caseText.includes(keyword.toLowerCase())
      )
    );
  };

  const filterGuidelines = (guidelinesList: any) => {
    if (!searchTerm) return guidelinesList;
    
    return guidelinesList.filter((guideline: any) =>
      guideline.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guideline.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guideline.summary.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const GuidelineCard = ({ guideline }: { guideline: any }) => (
    <Card className="border-slate-200 hover:border-blue-300 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-slate-900">{guideline.title}</CardTitle>
            <CardDescription className="flex items-center space-x-2 mt-1">
              <Badge variant="outline">{guideline.organization}</Badge>
              <Badge variant="secondary">{guideline.category}</Badge>
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-600 mb-4">{guideline.summary}</p>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>Updated: {new Date(guideline.lastUpdated).toLocaleDateString()}</span>
          </div>
          <Button variant="link" size="sm" className="p-0 h-auto">
            View Full Guideline
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const relevantGuidelines = getRelevantGuidelines();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-slate-900">Medical Guidelines</h2>
            <p className="text-sm text-slate-600">Evidence-based clinical guidelines and protocols</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-5 w-5 text-slate-400" />
        <Input
          placeholder="Search guidelines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Relevant Guidelines (if case is available) */}
      {relevantGuidelines.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-amber-500" />
            <h3 className="text-slate-900">Relevant to Current Case</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {relevantGuidelines.map(guideline => (
              <GuidelineCard key={guideline.id} guideline={guideline} />
            ))}
          </div>
        </div>
      )}

      {/* All Guidelines by Organization */}
      <Tabs defaultValue="who" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="who">WHO Guidelines</TabsTrigger>
          <TabsTrigger value="cdc">CDC Guidelines</TabsTrigger>
          <TabsTrigger value="nice">NICE Guidelines</TabsTrigger>
        </TabsList>

        <TabsContent value="who" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filterGuidelines(guidelines.who).map((guideline: any) => (
              <GuidelineCard key={guideline.id} guideline={guideline} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cdc" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filterGuidelines(guidelines.cdc).map((guideline: any) => (
              <GuidelineCard key={guideline.id} guideline={guideline} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nice" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filterGuidelines(guidelines.nice).map((guideline: any) => (
              <GuidelineCard key={guideline.id} guideline={guideline} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}