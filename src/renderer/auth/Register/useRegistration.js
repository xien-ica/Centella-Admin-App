import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { validateForm } from "./registerUtils"
import { registerAdmin, checkEmailExists, isInRegistrationProcess } from "../../services/registrationService"
import { useAuth } from "../../utils/AuthContext"

export const useRegistration = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    verificationCode: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [generatedId, setGeneratedId] = useState("") // Will be set after registration
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(30)
  
  const navigate = useNavigate()
  const { user } = useAuth()

  // Countdown effect for success modal
  useEffect(() => {
    let timer
    if (isModalOpen && countdown > 0) {
      timer = setTimeout(() => setCountdown(prev => prev - 1), 1000)
    } else if (isModalOpen && countdown === 0) {
      handleRedirectNow()
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isModalOpen, countdown])

  // Redirect authenticated users to dashboard (but NOT during registration)
  useEffect(() => {
    // Skip redirect if we're in the middle of registration
    if (isInRegistrationProcess()) {
      console.log('⭐️ Skipping redirect - registration in progress')
      return
    }

    if (user && user.account && !isModalOpen && !isLoading) {
      const isOnRegisterPage = window.location.pathname === '/register'
      
      // Only redirect if we're already logged in and not on register page
      if (!isOnRegisterPage) {
        console.log('User already logged in, redirecting to dashboard')
        navigate("/dashboard")
      }
    }
  }, [user, navigate, isModalOpen, isLoading])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (error) {
      setError("")
    }
  }

  const validateEmail = async (email) => {
    if (!email || !email.includes("@") || !email.includes(".")) {
      return "Please enter a valid email address"
    }

    try {
      const { exists, error } = await checkEmailExists(email)
      if (error) {
        console.error("Error checking email:", error)
        return "Error validating email. Please try again."
      }
      if (exists) {
        return "An admin account with this email already exists"
      }
    } catch (error) {
      console.error("Email validation error:", error)
      return "Error validating email. Please try again."
    }

    return null
  }

  const handleRedirectNow = () => {
    setIsModalOpen(false)
    navigate("/login")
  }

  // Helper function to send admin ID email
  const sendAdminIdEmail = async (email, adminId, firstName, lastName) => {
    try {
      console.log('📧 Attempting to send admin ID email to:', email)
      console.log('📧 Admin ID:', adminId)
      console.log('📧 Full name:', firstName, lastName)
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-admin-id`
      console.log('📧 Calling URL:', url)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          email,
          adminId,
          firstName,
          lastName
        })
      })

      console.log('📧 Response status:', response.status)
      const result = await response.json()
      console.log('📧 Response body:', result)
      
      if (!result.success) {
        console.error('❌ Failed to send admin ID email:', result.message)
        // Don't throw error - registration was successful, email is just a bonus
      } else {
        console.log('✅ Admin ID email sent successfully!')
      }
    } catch (error) {
      console.error('❌ Error sending admin ID email:', error)
      console.error('❌ Error details:', error.message, error.stack)
      // Don't throw - registration was successful
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    console.log('🔍 Starting registration submission...')
    
    // Validate form data
    const validationError = validateForm(formData)
    if (validationError) {
      console.error('❌ Validation error:', validationError)
      setError(validationError)
      return
    }

    console.log('✅ Form validation passed, checking email...')

    // Validate email uniqueness
    try {
      const emailError = await validateEmail(formData.email)
      if (emailError) {
        console.error('❌ Email validation error:', emailError)
        setError(emailError)
        return
      }
      console.log('✅ Email validation passed')
    } catch (error) {
      console.error('❌ Email validation threw error:', error)
      setError('Error validating email. Please try again.')
      return
    }

    setError("")
    setIsLoading(true)
    
    console.log('🔄 Loading state set, starting registration...')

    try {
      // Register admin with clean data
      const { data, error } = await registerAdmin({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        position: formData.position,
        email: formData.email.trim(),
        password: formData.password,
      })

      if (error) {
        console.error("❌ Registration error:", error)
        setError(error.message || "Registration failed. Please try again.")
        setIsLoading(false)
        return
      }

      console.log("✅ Registration successful")
      
      // Set the real admin ID from backend
      if (data.adminId) {
        setGeneratedId(data.adminId)
        console.log("🆔 Admin ID set to:", data.adminId)
        
        // 📧 Send admin ID via email
        console.log('📧 Now calling sendAdminIdEmail...')
        await sendAdminIdEmail(
          formData.email.trim(),
          data.adminId,
          formData.firstName.trim(),
          formData.lastName.trim()
        )
        console.log('📧 sendAdminIdEmail call completed')
      }
      
      setIsLoading(false)
      
      // Show success modal with countdown
      setCountdown(30)
      setIsModalOpen(true)
      
    } catch (error) {
      console.error("❌ Registration error:", error)
      setError("Registration failed. Please try again.")
      setIsLoading(false)
    }
  }

  return {
    formData,
    error,
    generatedId,
    showPassword,
    showConfirmPassword,
    isLoading,
    isModalOpen,
    countdown,
    handleChange,
    handleSubmit,
    handleRedirectNow,
    setShowPassword,
    setShowConfirmPassword,
    navigate,
    validateEmail,
  }
}