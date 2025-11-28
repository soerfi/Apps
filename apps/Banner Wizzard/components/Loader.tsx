
import React from 'react';

const Loader = ({ message }: { message: string }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
      <p className="text-white text-xl mt-4">{message}</p>
      <p className="text-gray-400 mt-2">This may take a moment...</p>
    </div>
  );
};

export default Loader;
