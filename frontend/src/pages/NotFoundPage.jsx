import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/'); // Navigate to the home page
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        p: 2,
      }}
    >
      <Typography variant="h1" sx={{ fontSize: { xs: '3rem', sm: '4rem' }, mb: 2 }}>
        404
      </Typography>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Oops! Page not found.
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, maxWidth: 'md' }}>
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={handleGoHome}
        sx={{ mt: 2 }}
      >
        Go to Home Page
      </Button>
    </Box>
  );
};

export default NotFound;
