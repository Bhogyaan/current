import React, { useState } from 'react';
import {
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Link,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useSetRecoilState } from 'recoil';
import authScreenAtom from '../atoms/authAtom';
import useShowToast from '../hooks/useShowToast';
import { useNavigate } from 'react-router-dom';

export default function SignupCard() {
  const [showPassword, setShowPassword] = useState(false);
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const showToast = useShowToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const [inputs, setInputs] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSignup = async () => {
    if (!inputs.name || !inputs.username || !inputs.email || !inputs.password || !inputs.confirmPassword) {
      showToast('Error', 'Please fill all fields', 'error');
      return;
    }

    if (inputs.password !== inputs.confirmPassword) {
      showToast('Error', 'Passwords do not match', 'error');
      return;
    }

    if (inputs.password.length < 6) {
      showToast('Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inputs.name,
          username: inputs.username,
          email: inputs.email,
          password: inputs.password,
        }),
      });
      const data = await res.json();

      if (data.error) {
        showToast('Error', data.error, 'error');
        return;
      }

      localStorage.removeItem('user-NRBLOG');
      showToast('Success', 'Signed up successfully. Please log in.', 'success');
      setTimeout(() => {
        setAuthScreen('login');
        navigate('/auth', { replace: true });
      }, 500);
    } catch (error) {
      showToast('Error', error.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ padding: isXs ? '0.5rem' : isSm ? '1rem' : '1.5rem' }}
    >
      <Typography
        variant={isXs ? 'h6' : 'h5'}
        sx={{
          textAlign: 'center',
          mb: isXs ? 1.5 : isSm ? 2 : 2.5,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          color: 'transparent',
          background: 'linear-gradient(90deg, #FFD700, #4ECDC4, #A1C4FD)',
          backgroundSize: '200% 200%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'gradientShift 5s ease infinite, textGlow 3s ease-in-out infinite alternate',
          fontSize: isXs ? '1.4rem' : isSm ? '1.6rem' : '1.8rem',
          '@keyframes gradientShift': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' }
          },
          '@keyframes textGlow': {
            '0%': { textShadow: '0 0 8px rgba(255, 215, 0, 0.3)' },
            '100%': { textShadow: '0 0 15px rgba(161, 196, 253, 0.5)' }
          }
        }}
      >
        Create Account
      </Typography>

      <Stack spacing={isXs ? 1.5 : isSm ? 2 : 2.5}>
        <FormControl fullWidth required>
          <TextField
            label="Full Name"
            type="text"
            placeholder="Enter full name"
            value={inputs.name}
            onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
            sx={textFieldStyles}
          />
        </FormControl>

        <FormControl fullWidth required>
          <TextField
            label="Username"
            type="text"
            placeholder="Enter username"
            value={inputs.username}
            onChange={(e) => setInputs({ ...inputs, username: e.target.value })}
            sx={textFieldStyles}
          />
        </FormControl>

        <FormControl fullWidth required>
          <TextField
            label="Email Address"
            type="email"
            placeholder="Enter email address"
            value={inputs.email}
            onChange={(e) => setInputs({ ...inputs, email: e.target.value })}
            sx={textFieldStyles}
          />
        </FormControl>

        <FormControl fullWidth required>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter password"
            value={inputs.password}
            onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
            sx={textFieldStyles}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((prev) => !prev)}
                    sx={{
                      color: '#E6E6FA',
                      '&:hover': {
                        color: '#A1C4FD',
                        backgroundColor: 'rgba(161, 196, 253, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {showPassword ? <VisibilityOff fontSize={isXs ? 'small' : 'medium'} /> : <Visibility fontSize={isXs ? 'small' : 'medium'} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </FormControl>

        <FormControl fullWidth required>
          <TextField
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={inputs.confirmPassword}
            onChange={(e) => setInputs({ ...inputs, confirmPassword: e.target.value })}
            sx={textFieldStyles}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((prev) => !prev)}
                    sx={{
                      color: '#E6E6FA',
                      '&:hover': {
                        color: '#A1C4FD',
                        backgroundColor: 'rgba(161, 196, 253, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {showPassword ? <VisibilityOff fontSize={isXs ? 'small' : 'medium'} /> : <Visibility fontSize={isXs ? 'small' : 'medium'} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </FormControl>

        <Button
          variant="contained"
          onClick={handleSignup}
          disabled={loading}
          fullWidth
          sx={{
            ...buttonStyles,
            py: isXs ? 1 : isSm ? 1.2 : 1.5,
            fontSize: isXs ? '0.9rem' : isSm ? '0.95rem' : '1rem',
          }}
        >
          {loading ? <CircularProgress size={isXs ? 20 : 24} sx={{ color: '#E6E6FA' }} /> : 'Sign Up'}
        </Button>

        <Typography
          variant="body2"
          sx={{
            fontFamily: "'Inter', sans-serif",
            color: 'rgba(230, 230, 250, 0.7)',
            textAlign: 'center',
            fontSize: isXs ? '0.8rem' : isSm ? '0.85rem' : '0.9rem',
            mt: isXs ? 0.5 : 1,
          }}
        >
          Already a user?{' '}
          <Link
            component="button"
            onClick={() => setAuthScreen('login')}
            sx={{
              color: '#A1C4FD',
              fontWeight: 600,
              position: 'relative',
              '&:hover': {
                color: '#C2E9FB',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: -2,
                  left: 0,
                  width: '100%',
                  height: '2px',
                  background: 'linear-gradient(90deg, #A1C4FD, #C2E9FB)',
                  animation: 'underlineGrow 0.3s ease-out forwards',
                  '@keyframes underlineGrow': {
                    '0%': { transform: 'scaleX(0)' },
                    '100%': { transform: 'scaleX(1)' }
                  }
                }
              },
            }}
          >
            Login
          </Link>
        </Typography>
      </Stack>
    </motion.div>
  );
}

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    background: 'rgba(20, 20, 30, 0.5)',
    '& fieldset': {
      borderColor: 'rgba(78, 205, 196, 0.3)',
      transition: 'all 0.3s ease',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(161, 196, 253, 0.5)',
      boxShadow: '0 0 10px rgba(161, 196, 253, 0.1)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#A1C4FD',
      boxShadow: '0 0 15px rgba(161, 196, 253, 0.2)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(230, 230, 250, 0.7)',
    fontFamily: "'Inter', sans-serif",
    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
    '&.Mui-focused': {
      color: '#A1C4FD',
    },
  },
  '& .MuiInputBase-input': {
    color: '#E6E6FA',
    fontFamily: "'Inter', sans-serif",
    padding: { xs: '12px 14px', sm: '14px 16px', md: '16px 18px' },
    '&::placeholder': {
      color: 'rgba(230, 230, 250, 0.5)',
      opacity: 1,
    },
  },
};

const buttonStyles = {
  borderRadius: 12,
  textTransform: 'none',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  background: 'linear-gradient(90deg, #FFD700, #4ECDC4, #A1C4FD)',
  backgroundSize: '200% 200%',
  boxShadow: '0 4px 15px rgba(161, 196, 253, 0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: 'linear-gradient(90deg, #FFC107, #4ECDC4, #A1C4FD)',
    backgroundSize: '200% 200%',
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 20px rgba(161, 196, 253, 0.5)',
  },
  '&:disabled': {
    background: 'rgba(230, 230, 250, 0.2)',
    boxShadow: 'none',
    color: 'rgba(230, 230, 250, 0.5)',
  },
};
