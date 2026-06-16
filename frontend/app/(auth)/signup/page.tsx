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

  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const { register, isLoading } = useAuth();
  const router = useRouter();

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

  const handleSendOtp = async () => {
    if (!email) return;
    setIsSendingOtp(true);
    try {
      await api.auth.sendOtp(email);
      toast({
        title: "Code Sent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to send verification code.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (requiresOtp && !otp.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    try {
      await register(name.trim(), email, password, requiresOtp ? otp.trim() : undefined);
      toast({ title: "Account created!", description: "Welcome to DocMind AI." });
      router.push("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Registration failed. Please try again.";
      if (message.includes("Verification code (OTP) is required") || message.includes("OTP is required")) {
        setRequiresOtp(true);
        toast({
          title: "Verification Required",
          description: "A verification code is required. Sending now...",
        });
        // We delay the OTP request slightly to ensure state is committed
        setTimeout(async () => {
          setIsSendingOtp(true);
          try {
            await api.auth.sendOtp(email);
            toast({
              title: "Code Sent",
              description: "A verification code has been sent to your email.",
            });
          } catch (sendErr: any) {
            const sendMsg = sendErr?.response?.data?.detail || "Failed to send verification code.";
            toast({
              title: "Error sending OTP",
              description: sendMsg,
              variant: "destructive",
            });
          } finally {
            setIsSendingOtp(false);
          }
        }, 100);
      } else {
        toast({ title: "Sign up failed", description: message, variant: "destructive" });
      }
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
            
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="text-white/50 text-sm mt-1">Start using DocMind AI for free</p>
          </div>

          {/* Signup Details Form */}
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
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

            {/* OTP Verification Code (conditional) */}
            {requiresOtp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Verification Code (OTP)
                </label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full input-dark pl-10 pr-4 py-3 text-sm focus:border-purple-500/30 focus:outline-none transition-all"
                      maxLength={6}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="px-4 py-3 rounded-xl border border-white/10 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    {isSendingOtp ? "Sending..." : "Resend"}
                  </button>
                </div>
                <p className="text-[10px] text-white/40">
                  Please enter the 6-digit verification code sent to your email.
                </p>
              </motion.div>
            )}

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
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="w-full btn-gradient py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 relative z-10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

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

