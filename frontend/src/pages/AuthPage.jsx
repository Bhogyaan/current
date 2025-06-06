import React, { useEffect, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Button, Typography, useMediaQuery, useTheme } from '@mui/material';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import LoginCard from '../components/LoginCard';
import SignupCard from '../components/SignupCard';
import authScreenAtom from '../atoms/authAtom';

const AuthPage = () => {
  const authScreenState = useRecoilValue(authScreenAtom);
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    });
  }, []);

  const particlesOptions = useMemo(() => ({
    particles: {
      number: {
        value: 80,
        density: {
          enable: true,
          value_area: 800
        }
      },
      color: {
        value: ['#FFD700', '#4ECDC4', '#4A4A72', '#FFFFFF']
      },
      shape: {
        type: 'circle',
        stroke: {
          width: 0,
          color: '#000000'
        },
        polygon: {
          nb_sides: 5
        }
      },
      opacity: {
        value: 0.5,
        random: true,
        anim: {
          enable: true,
          speed: 1,
          opacity_min: 0.1,
          sync: false
        }
      },
      size: {
        value: 3,
        random: true,
        anim: {
          enable: true,
          speed: 2,
          size_min: 0.1,
          sync: false
        }
      },
      line_linked: {
        enable: false
      },
      move: {
        enable: true,
        speed: 1,
        direction: 'none',
        random: true,
        straight: false,
        out_mode: 'out',
        bounce: false,
        attract: {
          enable: true,
          rotateX: 600,
          rotateY: 1200
        }
      }
    },
    interactivity: {
      detect_on: 'canvas',
      events: {
        onhover: {
          enable: true,
          mode: 'grab'
        },
        onclick: {
          enable: true,
          mode: 'push'
        },
        resize: true
      },
      modes: {
        grab: {
          distance: 140,
          line_linked: {
            opacity: 1
          }
        },
        push: {
          particles_nb: 4
        }
      }
    },
    retina_detect: true
  }), []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.2,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    }
  };

  const brandVariants = {
    hidden: { y: -30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    }
  };

  const authVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    }
  };

  const cardVariants = {
    enter: { opacity: 0, scale: 0.95 },
    center: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0A0A1A 0%, #1A1A3A 100%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0
        }}
      >
        <Particles id="tsparticles" options={particlesOptions} />
      </Box>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          width: '100%',
          maxWidth: isMobile ? '95vw' : '1000px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '2.5rem' : '3.5rem',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '2rem 1rem' : '2rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
          maxHeight: isMobile ? 'calc(100vh - 6rem)' : '100%',
        }}
      >
        <motion.div
          variants={brandVariants}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isMobile ? 'center' : 'flex-start',
            justifyContent: 'center',
            textAlign: isMobile ? 'center' : 'left',
            padding: isMobile ? '1rem' : '2rem'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
              cursor: 'pointer',
              '&:hover .logo': {
                transform: 'scale(1.1)',
                transition: 'transform 0.3s ease'
              },
              '&:hover .brand-name': {
                textShadow: '0 0 15px rgba(255, 215, 0, 0.7)'
              }
            }}
          >
            <Box
              className="logo"
              sx={{
                width: 50,
                height: 50,
                background: 'linear-gradient(135deg, #FFD700 0%, #4ECDC4 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '1.5rem',
                mr: 2,
                transition: 'transform 0.3s ease'
              }}
            >
              N
            </Box>
            <Typography
              variant={isMobile ? 'h4' : 'h2'}
              className="brand-name"
              sx={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 800,
                lineHeight: 1.2,
                background: 'linear-gradient(90deg, #FFD700, #4ECDC4, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                animation: 'gradientShift 5s ease infinite',
                '@keyframes gradientShift': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }}
            >
              NR Blog
            </Typography>
          </Box>

          <Typography
            variant={isMobile ? 'h6' : 'h4'}
            sx={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              mb: 3,
              maxWidth: isMobile ? '100%' : '28rem',
              lineHeight: 1.5,
            }}
          >
            Where Ideas <span style={{ color: '#FFD700' }}>Spark</span> and Stories <span style={{ color: '#4ECDC4' }}>Shine</span>
          </Typography>

          <Typography
            variant={isMobile ? 'body1' : 'h6'}
            sx={{
              fontFamily: "'Inter', sans-serif",
              color: 'rgba(255, 255, 255, 0.75)',
              maxWidth: isMobile ? '100%' : '28rem',
              lineHeight: 1.7,
              fontWeight: 400
            }}
          >
            Join a creative community to share your unique voice and discover inspiring stories.
          </Typography>
        </motion.div>

        <motion.div
          variants={authVariants}
          style={{
            flex: 1,
            maxWidth: isMobile ? '100%' : '22rem',
            width: '100%',
            minWidth: isMobile ? 'auto' : '18rem'
          }}
        >
          <Box
            sx={{
              p: isMobile ? 3 : 3.5,
              borderRadius: 4,
              background: 'rgba(20, 20, 30, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(78, 205, 196, 0.2)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.4s ease',
              '&:hover': {
                boxShadow: '0 15px 50px rgba(78, 205, 196, 0.2)',
                borderColor: 'rgba(78, 205, 196, 0.4)'
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, mb: 4 }}>
              <Button
                fullWidth
                variant={authScreenState === 'login' ? 'contained' : 'outlined'}
                onClick={() => setAuthScreen('login')}
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  letterSpacing: '0.5px',
                  textTransform: 'none',
                  color: authScreenState === 'login' ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                  background: authScreenState === 'login'
                    ? 'linear-gradient(135deg, #FFD700 0%, #4A4A72 100%)'
                    : 'transparent',
                  border: authScreenState === 'login'
                    ? 'none'
                    : '1px solid rgba(78, 205, 196, 0.4)',
                  transition: 'all 0.3s ease',
                  boxShadow: authScreenState === 'login'
                    ? '0 4px 15px rgba(78, 205, 196, 0.3)'
                    : 'none',
                  '&:hover': {
                    background: authScreenState === 'login'
                      ? 'linear-gradient(135deg, #FFD700 0%, #4A4A72 100%)'
                      : 'rgba(78, 205, 196, 0.1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(78, 205, 196, 0.3)'
                  }
                }}
              >
                Sign In
              </Button>
              <Button
                fullWidth
                variant={authScreenState === 'signup' ? 'contained' : 'outlined'}
                onClick={() => setAuthScreen('signup')}
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  letterSpacing: '0.5px',
                  textTransform: 'none',
                  color: authScreenState === 'signup' ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                  background: authScreenState === 'signup'
                    ? 'linear-gradient(135deg, #FFD700 0%, #4A4A72 100%)'
                    : 'transparent',
                  border: authScreenState === 'signup'
                    ? 'none'
                    : '1px solid rgba(78, 205, 196, 0.4)',
                  transition: 'all 0.3s ease',
                  boxShadow: authScreenState === 'signup'
                    ? '0 4px 15px rgba(78, 205, 196, 0.3)'
                    : 'none',
                  '&:hover': {
                    background: authScreenState === 'signup'
                      ? 'linear-gradient(135deg, #FFD700 0%, #4A4A72 100%)'
                      : 'rgba(78, 205, 196, 0.1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(78, 205, 196, 0.3)'
                  }
                }}
              >
                Sign Up
              </Button>
            </Box>

            <AnimatePresence mode='wait'>
              <motion.div
                key={authScreenState}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {authScreenState === 'login' ? <LoginCard /> : <SignupCard />}
              </motion.div>
            </AnimatePresence>
          </Box>
        </motion.div>
      </motion.div>
    </Box>
  );
};

export default AuthPage;
