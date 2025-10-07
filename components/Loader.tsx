
import React from 'react';
import { RobotIcon } from './icons';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <RobotIcon className="w-16 h-16 text-cyan-400 animate-bounce" />
      <p className="mt-4 text-xl text-slate-300">{message}</p>
    </div>
  );
};

export default Loader;
