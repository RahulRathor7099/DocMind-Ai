"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Brain, ArrowRight, AlertCircle, User, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AnimatedBackground } from "@/components/common/AnimatedBackground";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { toast } from "@/hooks/use-toast";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  // OTP states
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const { register, isLoading } = useAuth();
  const router = useRouter();

  // Timer countdown hook
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    else if (name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";
    
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Enter a valid email";
    
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSendingOtp(true);
    try {
      const res = await api.auth.sendOtp(email);
      toast({
        title: "Verification Code Sent",
        description: res.message || "Please check your email/console for the OTP.",
      });
      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
      } else {
        setDebugOtp(null);
      }
      setStep("otp");
      setTimer(60);
      setOtpError("");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to send verification code. Please try again.";
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setIsSendingOtp(true);
    try {
      const res = await api.auth.sendOtp(email);
      toast({
        title: "Code Resent Successfully",
        description: res.message || "Please check your email/console for the new code.",
      });
      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
      } else {
        setDebugOtp(null);
      }
      setTimer(60);
      setOtp("");
      setOtpError("");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to resend code. Please try again.";
      toast({ title: "Resend failed", description: message, variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter a valid 6-digit code.");
      return;
    }

    try {
      await register(name.trim(), email, password, otp);
      toast({ title: "Account created!", description: "Welcome to DocMind AI." });
      router.push("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Invalid or expired verification code.";
      setOtpError(message);
      toast({ title: "Sign up failed", description: message, variant: "destructive" });
    }
  };

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-card p-8 border border-white/10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
              className="relative mb-4"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 opacity-30 blur-lg scale-150" />
              <img
                src="/logo.png"
                alt="DocMind AI Logo"
                className="relative w-14 h-14 rounded-2xl object-cover"
              />
            </motion.div>
            
            {step === "form" ? (
              <>
                <h1 className="text-2xl font-bold text-white">Create your account</h1>
                <p className="text-white/50 text-sm mt-1">Start using DocMind AI for free</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">Verify your email</h1>
                <p className="text-white/50 text-sm mt-1 text-center px-4">
                  We sent a 6-digit verification code to <span className="text-purple-400 font-semibold">{email}</span>
                </p>
              </>
            )}
          </div>

          {step === "form" ? (
            /* Signup Details Form */
            <form onSubmit={handleSendOtp} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError("name"); }}
                    placeholder="John Doe"
                    className={`w-full input-dark pl-10 pr-4 py-3 text-sm ${errors.name ? "border-red-500/60" : ""}`}
                  />
                </div>
                {errors.name && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </motion.p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                    placeholder="you@example.com"
                    className={`w-full input-dark pl-10 pr-4 py-3 text-sm ${errors.email ? "border-red-500/60" : ""}`}
                  />
                </div>
                {errors.email && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </motion.p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                    placeholder="Min. 8 characters"
                    className={`w-full input-dark pl-10 pr-12 py-3 text-sm ${errors.password ? "border-red-500/60" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </motion.p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearError("confirmPassword"); }}
                    placeholder="Repeat password"
                    className={`w-full input-dark pl-10 pr-12 py-3 text-sm ${errors.confirmPassword ? "border-red-500/60" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword}
                  </motion.p>
                )}
              </div>

              {/* Terms */}
              <p className="text-xs text-white/30 text-center">
                By signing up, you agree to our{" "}
                <span className="text-purple-400 hover:text-purple-300 cursor-pointer">Terms of Service</span>
                {" "}and{" "}
                <span className="text-purple-400 hover:text-purple-300 cursor-pointer">Privacy Policy</span>
              </p>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isSendingOtp}
                whileHover={{ scale: isSendingOtp ? 1 : 1.02 }}
                whileTap={{ scale: isSendingOtp ? 1 : 0.98 }}
                className="w-full btn-gradient py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSendingOtp ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          ) : (
            /* OTP Verification Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-3 text-center">
                  Verification Code (OTP)
                </label>
                <div className="relative max-w-[240px] mx-auto">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ""));
                      setOtpError("");
                    }}
                    placeholder="123456"
                    className="w-full input-dark pl-11 pr-4 py-3.5 text-center text-lg font-bold letter-spacing-3 tracking-widest border border-purple-500/20 focus:border-purple-500/80"
                  />
                </div>
                {otpError && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs text-red-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {otpError}
                  </motion.p>
                )}
                
                {debugOtp && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md text-center max-w-[320px] mx-auto shadow-[0_0_20px_rgba(168,85,247,0.15)] animate-pulse"
                  >
                    <p className="text-xs text-purple-300 font-semibold tracking-wider flex items-center justify-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      DEVELOPER MODE ACTIVE
                    </p>
                    <p className="text-[11px] text-white/50 mt-1">
                      Enter the code below to complete verification:
                    </p>
                    <div className="mt-2.5 text-2xl font-mono font-bold tracking-widest text-purple-200 bg-purple-500/10 border border-purple-500/20 rounded-lg py-1.5 px-3 select-all cursor-pointer hover:bg-purple-500/25 transition-colors">
                      {debugOtp}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Countdown/Resend Section */}
              <div className="text-center text-sm">
                {timer > 0 ? (
                  <p className="text-white/40">
                    Resend code in <span className="text-purple-400 font-semibold">{timer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                    className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4 disabled:opacity-50"
                  >
                    {isSendingOtp ? "Resending..." : "Resend Verification Code"}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Submit Register */}
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                  className="w-full btn-gradient py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      Verify & Create Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                {/* Back Link */}
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setOtp("");
                    setOtpError("");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change signup details
                </button>
              </div>
            </form>
          )}

          {/* Login link */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-transparent text-white/30 text-xs">Already have an account?</span>
            </div>
          </div>
          <motion.button
            onClick={() => router.push("/login")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3 rounded-xl font-semibold text-sm border border-white/10 text-white/70 hover:text-white hover:border-purple-500/40 hover:bg-white/5 transition-all block"
          >
            Sign in instead
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
