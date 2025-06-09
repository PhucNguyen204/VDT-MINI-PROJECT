import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useCreatePipelineStore, usePipelineStore } from '../store';
import { Card, Progress } from '../components/ui/UIElements';
import { Button } from '../components/ui/FormElements';
import { BasicInfoStep } from '../components/pipeline/BasicInfoStep';
import { SourceConfigStep } from '../components/pipeline/SourceConfigStep';
import { ReviewStep } from '../components/pipeline/ReviewStep';

const steps = [
  { id: 1, name: 'Basic Info', component: BasicInfoStep },
  { id: 2, name: 'Sources & Configuration', component: SourceConfigStep },
  { id: 3, name: 'Review', component: ReviewStep },
];

export const CreatePipeline: React.FC = () => {
  const navigate = useNavigate();
  const { createPipeline } = usePipelineStore();
  const { 
    currentStep, 
    formData, 
    setCurrentStep, 
    resetForm,
    isStepValid 
  } = useCreatePipelineStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData?.component;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createPipeline(formData);
      resetForm();
      navigate(`/pipelines/${result.id}`);
    } catch (error) {
      console.error('Failed to create pipeline:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const canGoNext = isStepValid(currentStep + 1); // isStepValid expects 1-based indexing
  const canGoPrevious = currentStep > 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Pipeline</h1>
          <p className="text-gray-600">Set up a new vector data processing pipeline</p>
        </div>        <Button
          variant="secondary"
          onClick={() => navigate('/pipelines')}
        >
          Cancel
        </Button>
      </div>

      {/* Progress */}
      <Card className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="mb-6" />
        </div>
        
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between relative">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className="flex flex-col items-center relative flex-1">
                {/* Connector Line */}
                {stepIdx !== steps.length - 1 && (
                  <div 
                    className={`absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2 ${
                      stepIdx < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    style={{ left: '50%', right: '-50%', width: 'calc(100% - 16px)' }}
                  />
                )}
                
                {/* Step Circle */}
                <div className={`
                  relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white
                  ${stepIdx < currentStep ? 'border-blue-600 bg-blue-600' : 
                    stepIdx === currentStep ? 'border-blue-600 bg-white' : 'border-gray-300 bg-white'}
                `}>
                  {stepIdx < currentStep ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : stepIdx === currentStep ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  )}
                </div>
                
                {/* Step Label */}
                <span className="mt-3 text-xs font-medium text-gray-600 text-center max-w-24">
                  {step.name}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </Card>      {/* Step Content */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {currentStepData?.name}
          </h2>
          {StepComponent && <StepComponent />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t border-gray-200">          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={!canGoNext || isSubmitting}
              loading={isSubmitting}
            >
              Create Pipeline
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canGoNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
