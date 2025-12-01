import React from 'react';

class AdErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('AdErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="ad-error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-800">
                        광고를 불러오는 중 오류가 발생했습니다.
                    </div>
                    {process.env.NODE_ENV === 'development' && (
                        <details className="mt-2">
                            <summary className="text-xs text-red-600 cursor-pointer">오류 세부사항</summary>
                            <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
                                {this.state.error?.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default AdErrorBoundary;
