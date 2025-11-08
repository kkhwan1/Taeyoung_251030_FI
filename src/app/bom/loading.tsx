import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <LoadingSpinner size="lg" />
    </div>
  );
}
