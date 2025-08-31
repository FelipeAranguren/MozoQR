import React from 'react'
import { AppBar, Toolbar, Typography, Button, Link } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

// ⬇️ botón Google
import LoginWithGoogleButton from './LoginWithGoogleButton'
// ⬇️ auth hook
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <AppBar position="static">
      <Toolbar>
        <Link
          component={RouterLink}
          to="/"
          color="inherit"
          underline="none"
          sx={{ flexGrow: 1 }}
        >
          <Typography variant="h6">MozoQR</Typography>
        </Link>

        {isAuthenticated ? (
          <>
            <Typography sx={{ mr: 2 }}>
              {user?.username || user?.email || 'Usuario'}
            </Typography>
            <Button color="inherit" onClick={logout}>
              Salir
            </Button>
          </>
        ) : (
          <LoginWithGoogleButton />
        )}
      </Toolbar>
    </AppBar>
  )
}
