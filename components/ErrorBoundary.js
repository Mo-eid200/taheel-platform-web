"use client";
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // سجل الخطأ لخادم اللوجات (اختياري) أو في console
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="max-w-xl w-full bg-white rounded-xl p-6 shadow text-left">
            <h2 className="text-lg font-bold mb-2">حدث خطأ أثناء عرض الصفحة</h2>
            <p className="text-sm text-gray-700 mb-3">نعتذر — حصل خطأ غير متوقع أثناء تحميل المحتوى. الرجاء إعادة المحاولة أو التواصل مع الدعم.</p>
            <details className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
              <summary className="cursor-pointer">تفاصيل الخطأ (للمطوّرين)</summary>
              <pre className="whitespace-pre-wrap">{String(this.state.error)}{this.state.info ? "\n\n" + JSON.stringify(this.state.info.componentStack, null, 2) : ""}</pre>
            </details>
            <div className="mt-4 flex gap-2">
              <button onClick={() => location.reload()} className="px-4 py-2 bg-emerald-600 text-white rounded">إعادة المحاولة</button>
              <button onClick={() => window.history.back()} className="px-4 py-2 border rounded">العودة للخلف</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}