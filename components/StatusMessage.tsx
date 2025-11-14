
import React from 'react';

interface StatusMessageProps {
  message: string;
  type?: 'success' | 'info';
}

const StatusMessage: React.FC<StatusMessageProps> = ({ message, type = 'info' }) => {
  const baseClasses = "w-full max-w-lg p-4 border rounded-lg text-center";
  const typeClasses = {
    info: "bg-blue-900/30 border-blue-500/50 text-blue-200",
    success: "bg-green-900/30 border-green-500/50 text-green-200",
  };
  
  // Basic class names for light theme
  const lightThemeTypeClasses = {
    info: "bg-blue-100 border-blue-300 text-blue-800",
    success: "bg-green-100 border-green-300 text-green-800",
  };
  
  // This is a simplified way to handle theming without context, suitable for this component
  const themeStyles = `
    .status-info {
        background-color: ${typeClasses.info.split(' ')[0]};
        border-color: ${typeClasses.info.split(' ')[1]};
        color: ${typeClasses.info.split(' ')[2]};
    }
    html[data-theme="light"] .status-info {
        background-color: ${lightThemeTypeClasses.info.split(' ')[0]};
        border-color: ${lightThemeTypeClasses.info.split(' ')[1]};
        color: ${lightThemeTypeClasses.info.split(' ')[2]};
    }
    .status-success {
        background-color: ${typeClasses.success.split(' ')[0]};
        border-color: ${typeClasses.success.split(' ')[1]};
        color: ${typeClasses.success.split(' ')[2]};
    }
    html[data-theme="light"] .status-success {
        background-color: ${lightThemeTypeClasses.success.split(' ')[0]};
        border-color: ${lightThemeTypeClasses.success.split(' ')[1]};
        color: ${lightThemeTypeClasses.success.split(' ')[2]};
    }
  `;

  return (
    <>
      <style>{themeStyles}</style>
      <div className={`${baseClasses} status-${type}`} role="status">
        <p className="text-sm font-medium">{message}</p>
      </div>
    </>
  );
};

export default StatusMessage;
