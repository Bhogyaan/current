import React, { useState } from 'react';
import {
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  Stack,
  Link,
  TextField,
  Typography,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useSetRecoilState } from 'recoil';
import authScreenAtom from '../atoms/authAtom';
import useShowToast from '../hooks/useShowToast';
import userAtom from '../atoms/userAtom';
import { useNavigate } from 'react-router-dom';

export default function LoginCard({ isAdmin = false }) {
  const [showPassword, setShowPassword] = useState(false);
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const setUser = useSetRecoilState(userAtom);
  const [loading, setLoading] = useState(false);
  const showToast = useShowToast();
  const navigate = useNavigate();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const [inputs, setInputs] = useState({
    username: isAdmin ? 'adminblog' : '',
    password: isAdmin ? 'Admin123' : '',
  });

  const handleLogin = async () => {
    if (!inputs.username || !inputs.password) {
      showToast('Error', 'Please fill all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isAdmin ? '/api/users/admin/login' : '/api/users/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });

      const data = await res.json();
      if (data.error) {
        showToast('Error', data.error, 'error');
        return;
      }

      localStorage.setItem('user-NRBLOG', JSON.stringify(data));
      setUser(data);
      showToast('Success', `Logged in as ${isAdmin ? 'admin' : 'user'} successfully`, 'success');
      navigate(isAdmin ? '/admin-dashboard' : '/dashboard');
    } catch (error) {
      showToast('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: isXs ? '0.5rem' : isSm ? '1rem' : '1.5rem 0' }}
    >
      <Typography
        variant={isXs ? 'h6' : 'h5'}
        sx={{
          textAlign: 'center',
          mb: isXs ? 2 : isSm ? 2.5 : 3,
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
        {isAdmin ? 'Admin Login' : 'Welcome Back'}
      </Typography>

      <Stack spacing={isXs ? 2 : isSm ? 2.5 : 3}>
        <FormControl fullWidth required>
          <TextField
            label="Username"
            type="text"
            value={inputs.username}
            onChange={(e) => !isAdmin && setInputs((prev) => ({ ...prev, username: e.target.value }))}
            disabled={isAdmin}
            placeholder="Enter username"
            sx={{
              ...textFieldStyles,
              '& .MuiInputBase-input': {
                fontSize: isXs ? '0.9rem' : isSm ? '0.95rem' : '1rem',
              },
            }}
          />
        </FormControl>

        <FormControl fullWidth required>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={inputs.password}
            onChange={(e) => !isAdmin && setInputs((prev) => ({ ...prev, password: e.target.value }))}
            disabled={isAdmin}
            placeholder="Enter password"
            sx={{
              ...textFieldStyles,
              '& .MuiInputBase-input': {
                fontSize: isXs ? '0.9rem' : isSm ? '0.95rem' : '1rem',
              },
            }}
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
                    {showPassword ? (
                      <VisibilityOff fontSize={isXs ? 'small' : 'medium'} />
                    ) : (
                      <Visibility fontSize={isXs ? 'small' : 'medium'} />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </FormControl>

        <Button
          variant="contained"
          onClick={handleLogin}
          disabled={loading}
          fullWidth
          sx={{
            ...buttonStyles,
            py: isXs ? 1.1 : isSm ? 1.2 : 1.3,
            fontSize: isXs ? '0.9rem' : isSm ? '0.95rem' : '1rem',
            fontWeight: 600,
            letterSpacing: '0.5px',
            mt: isXs ? 1 : 1.5,
            background: loading
              ? 'rgba(255, 215, 0, 0.3)'
              : 'linear-gradient(90deg, #FFD700, #4ECDC4, #A1C4FD)',
            backgroundSize: '200% 200%',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #FFD700, #4ECDC4, #A1C4FD, #C2E9FB)',
              backgroundSize: '300% 300%',
              opacity: 0,
              transition: 'all 0.5s ease',
              zIndex: -1
            },
            '&:hover': {
              animation: 'gradientShift 4s ease infinite',
              transform: 'translateY(-3px)',
              boxShadow: '0 8px 20px rgba(161, 196, 253, 0.5)',
              '&::before': {
                opacity: 1
              }
            },
            '&:disabled': {
              transform: 'none',
              boxShadow: 'none',
              '&::before': {
                opacity: 0
              }
            },
            '@keyframes gradientShift': {
              '0%': { backgroundPosition: '0% 50%' },
              '50%': { backgroundPosition: '100% 50%' },
              '100%': { backgroundPosition: '0% 50%' }
            }
          }}
        >
          {loading ? (
            <CircularProgress
              size={isXs ? 22 : 24}
              sx={{ color: '#E6E6FA' }}
            />
          ) : (
            'Log In'
          )}
        </Button>

        {!isAdmin && (
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
            Not a user?{' '}
            <Link
              component="button"
              onClick={() => setAuthScreen('signup')}
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
              Sign Up
            </Link>
          </Typography>
        )}
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
  transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
  boxShadow: '0 4px 15px rgba(161, 196, 253, 0.3)',
  '&:disabled': {
    background: 'rgba(230, 230, 250, 0.1)',
    boxShadow: 'none',
    color: 'rgba(230, 230, 250, 0.3)',
  },
};
