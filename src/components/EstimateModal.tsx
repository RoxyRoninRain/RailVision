'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Calculator, MapPin, X, ArrowRight, DollarSign } from 'lucide-react';
import { calculateEstimate } from '@/app/actions/estimate';

interface EstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    styleId: string;
    styleName: string;
    onRequestQuote?: (data: any) => void;
}

export function EstimateModal({ isOpen, onClose, styleId, styleName, onRequestQuote }: EstimateModalProps) {
    const [step, setStep] = useState<'input' | 'result'>('input');
    const [linearFeet, setLinearFeet] = useState(20);
    const [zipCode, setZipCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Result State
    const [estimate, setEstimate] = useState<{
        min: number;
        max: number;
        distance: number;
        breakdown?: any;
    } | null>(null);

    const handleCalculate = async () => {
        if (!zipCode || zipCode.length < 5) {
            setError('Please enter a valid Zip Code');
            return;
        }
        setError('');
        setLoading(true);

        try {
            const result = await calculateEstimate({
                styleId,
                linearFeet,
                zipCode
            });

            if (result.error) {
                setError(typeof result.error === 'string' ? result.error : 'Failed to calculate');
            } else {
                setEstimate({
                    min: result.minPrice || 0,
                    max: result.maxPrice || 0,
                    distance: result.distance || 0,
                    breakdown: result.breakdown
                });
                setStep('result');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-md w-full relative shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
                            <X size={20} />
                        </button>

                        <div className="mb-6 relative z-10">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-blue-500" />
                                Instant Estimate
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Get a quick price range for <strong>{styleName}</strong>.
                            </p>
                        </div>

                        {step === 'input' ? (
                            <div className="space-y-6 relative z-10">
                                {/* Linear Feet Slider */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <label className="text-gray-300 font-medium">Linear Feet</label>
                                        <span className="text-blue-400 font-bold">{linearFeet} ft</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="200"
                                        step="1"
                                        value={linearFeet}
                                        onChange={(e) => setLinearFeet(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                {/* Zip Code */}
                                <div className="space-y-2">
                                    <label className="text-sm text-gray-300 font-medium">Project Zip Code</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                        <input
                                            type="text"
                                            placeholder="Enter Zip Code"
                                            value={zipCode}
                                            onChange={(e) => setZipCode(e.target.value)}
                                            className="w-full bg-[#050505] border border-[#333] pl-9 p-3 rounded-lg text-white focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {error && <p className="text-xs text-red-500">{error}</p>}

                                <button
                                    onClick={handleCalculate}
                                    disabled={loading}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Estimate'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 relative z-10 animate-in fade-in zoom-in duration-300">
                                <div className="text-center p-6 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <DollarSign className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Estimated Range</h3>
                                    <div className="text-3xl font-black text-white">
                                        {formatCurrency(estimate?.min || 0)} - {formatCurrency(estimate?.max || 0)}
                                    </div>
                                    {estimate && estimate.distance > 0 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            Includes travel fee for {estimate.distance.toFixed(1)} miles
                                        </p>
                                    )}
                                    )}
                                </div>

                                <p className="text-[10px] text-gray-500 text-center px-2 leading-relaxed -mt-2">
                                    Preliminary estimate subject to site inspection and final material selection. Final price will be confirmed in a formal contract.
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => onRequestQuote && onRequestQuote({
                                            min: formatCurrency(estimate?.min || 0),
                                            max: formatCurrency(estimate?.max || 0),
                                            linearFeet,
                                            zipCode
                                        })}
                                        className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-all">
                                        Request Official Quote
                                    </button>
                                    <button
                                        onClick={() => setStep('input')}
                                        className="w-full py-3 bg-transparent text-gray-400 hover:text-white text-sm font-medium transition-colors"
                                    >
                                        Recalculate
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
