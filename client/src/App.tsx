import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import {  
CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Menu,
  FormControl,
  InputLabel,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Grid from '@mui/material/Grid';

function App() {
      // Auth state
      const [showSignup, setShowSignup] = useState(false);
      const [showConfirmEmail, setShowConfirmEmail] = useState(false);
      const [signupForm, setSignupForm] = useState({
        name: '',
        surname: '',
        username: '',
        emailAddress: '',
        password: ''
      });
      const [signupLoading, setSignupLoading] = useState(false);
      const [signupError, setSignupError] = useState('');
      const [confirmToken, setConfirmToken] = useState('');
      const [confirmLoading, setConfirmLoading] = useState(false);
      const [confirmError, setConfirmError] = useState('');

      // User menu state
      const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
      const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setUserMenuAnchor(event.currentTarget);
      };
      const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
      };
      const handleLogout = () => {
        setLoggedIn(false);
        setUsername('');
        setPassword('');
        setError('');
        setSnackbar({ open: true, message: 'Logged out successfully.', severity: 'info' });
        handleUserMenuClose();
      };

      // Forgot password state
      const [showForgotPassword, setShowForgotPassword] = useState(false);
      const [forgotEmail, setForgotEmail] = useState('');
      const [forgotCode, setForgotCode] = useState('');
      const [forgotNewPassword, setForgotNewPassword] = useState('');
      const [forgotStep, setForgotStep] = useState(1); // 1: request, 2: reset
      const [forgotLoading, setForgotLoading] = useState(false);
      const [forgotError, setForgotError] = useState('');
      // ...existing code...
      // Signup logic
      const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSignupForm({ ...signupForm, [e.target.name]: e.target.value });
      };
      const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSignupLoading(true);
        setSignupError('');
        try {
          const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signupForm)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Signup failed');
          setShowSignup(false);
          setShowConfirmEmail(true);
          setSnackbar({ open: true, message: data.message, severity: 'info' });
        } catch (err: any) {
          setSignupError(err.message);
        } finally {
          setSignupLoading(false);
        }
      };
      // Email confirmation logic
      const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfirmLoading(true);
        setConfirmError('');
        try {
          const res = await fetch('/api/confirm-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: confirmToken })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Confirmation failed');
          setShowConfirmEmail(false);
          setSnackbar({ open: true, message: data.message, severity: 'success' });
        } catch (err: any) {
          setConfirmError(err.message);
        } finally {
          setConfirmLoading(false);
        }
      };
    // Auth state
    const [loggedIn, setLoggedIn] = useState(false);
    // Invoices state for statement dropdown
    const [invoices, setInvoices] = useState<any[]>([]);
    const [statementDialogOpen, setStatementDialogOpen] = useState(false);
    const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
    const [statementLoading, setStatementLoading] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openMenu = Boolean(anchorEl);
    // useEffect to fetch invoices (only when logged in)
    useEffect(() => {
      if (!loggedIn) return;
      fetch('/api/invoices')
        .then(res => res.json())
        .then(data => setInvoices(data));
    }, [loggedIn]);
    // Handle dropdown menu for invoice/statement
    const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
      setAnchorEl(null);
    };
    const handleMenuSelect = (option: string) => {
      setAnchorEl(null);
      if (option === 'invoice') {
        handleGenerateInvoice();
      } else if (option === 'statement') {
        setStatementDialogOpen(true);
      }
    };
    // Handle statement generation
    const handleGenerateStatement = async () => {
      if (!selectedInvoiceNo) return;
      setStatementLoading(true);
      try {
        const response = await fetch('/api/statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoiceNo: selectedInvoiceNo })
        });
        if (!response.ok) throw new Error('Failed to generate statement');

        const emailSent = response.headers.get('X-Email-Sent');
        if (emailSent === 'false') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `statement_${selectedInvoiceNo}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setSnackbar({ open: true, message: 'Statement downloaded, but email failed to send.', severity: 'warning' });
        } else {
          setSnackbar({ open: true, message: 'Statement generated and email sent successfully!', severity: 'success' });
        }
      } catch (err) {
        setSnackbar({ open: true, message: 'Error generating statement.', severity: 'error' });
      } finally {
        setStatementLoading(false);
        setStatementDialogOpen(false);
        setSelectedInvoiceNo('');
      }
    };

    // Login state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const dateRef = useRef<HTMLInputElement | null>(null);
    const dateRefMonth = useRef<HTMLInputElement | null>(null);

    // Invoice loading and snackbar state
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '' });

    // Trip state
    const [trips, setTrips] = useState<any[]>([]);
    const [tripForm, setTripForm] = useState({
      shiftType: '',
      direction: '',
      driver: '',
      tripDate: '',
      quantity: 1
    });
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editTrip, setEditTrip] = useState<any | null>(null);

    // Lookup state
    const [shiftTypes, setShiftTypes] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [shiftRates, setShiftRates] = useState<Record<string, number>>({});

  // Removed dummy credentials


    // useEffect to fetch shift types (only when logged in)
    useEffect(() => {
      if (!loggedIn) return;
      fetch('/api/shift-types')
        .then(res => res.json())
        .then(data => {
          setShiftTypes(data.map((st: any) => ({ value: st.name, label: st.description })));
        });
    }, [loggedIn]);

    // useEffect to fetch drivers (only when logged in)
    useEffect(() => {
      if (!loggedIn) return;
      fetch('/api/drivers')
        .then(res => res.json())
        .then(data => {
          setDrivers(data.map((d: any) => ({ value: (d.name), label: `${d.name}` })));
        });
    }, [loggedIn]);

    // useEffect to fetch trips (only when logged in)
    useEffect(() => {
      if (!loggedIn) return;
      fetch('/api/trips')
        .then(res => res.json())
        .then(data => {
          setTrips(data.map((trip: any) => ({
            ...trip,
            id: trip.id,
            shiftType: trip.shifttype,
            tripDate: trip.trip_date,
            dateCaptured: trip.date_created,
            direction: trip.direction,
            userCreated: trip.user_created || '',
            userUpdated: trip.user_updated || ''
          })));
        });
    }, [loggedIn]);

    // useEffect to fetch shift rates (only when logged in)
    useEffect(() => {
      if (!loggedIn) return;
      fetch('/api/shift-rates')
        .then(res => res.json())
        .then(data => {
          // Map shiftTypeId to rate, then map to shiftType name
          // We'll need to join with shiftTypes once loaded
          // For now, store as { [shiftTypeId]: rate }
          const ratesById: Record<number, number> = {};
          data.forEach((row: any) => {
            ratesById[row.shifttypeid] = Number(row.rate);
          });
          setShiftRates(ratesById);
        });
    }, [loggedIn]);

  // Helper to get rate by shiftType name
  const getRateByShiftType = (shiftTypeName: string) => {
    const st = shiftTypes.find(st => st.value === shiftTypeName);
    if (!st) return 0;
    // Find shiftTypeId by name
    const idx = shiftTypes.findIndex(st2 => st2.value === shiftTypeName);
    // shiftRates keys are shiftTypeId (1-based)
    return shiftRates[idx + 1] || 0;
  };

  // Login logic
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid username or password');
        return;
      }
      setLoggedIn(true);
      setError('');
      setSnackbar({ open: true, message: 'Login successful!', severity: 'success' });
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  // Trip form loading state
  const [addTripLoading, setAddTripLoading] = useState(false);
  // Trip form logic
  const handleTripFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTripForm({ ...tripForm, [e.target.name]: e.target.value });
  };
  const handleTripFormSelect = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    setTripForm({ ...tripForm, [e.target.name as string]: e.target.value });
  };
  //Backend API call(addTrip) to add trip to database(Postgres, Trip table)
  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddTripLoading(true);
    const qty = Number(tripForm.quantity) || 1;
    for (let i = 0; i < qty; i++) {
      await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftType: tripForm.shiftType,
          direction: tripForm.direction,
          driver: 'Kostile',
          tripDate: tripForm.tripDate,
          userCreated: username
        })
      });
    }
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => setTrips(data.map((trip: any) => ({
        ...trip,
        id: trip.id,
        shiftType: trip.shifttype,
        tripDate: trip.trip_date,
        dateCaptured: trip.date_created,
        driver: trip.driver,
        direction: trip.direction,
        userCreated: trip.user_created || '',
        userUpdated: trip.user_updated || ''
      }))));
    setTripForm({
      shiftType: '',
      direction: '',
      driver: '',
      tripDate: '',
      quantity: 1
    });
    setAddTripLoading(false);
  };

  // Edit trip logic
  const handleEditClick = (trip: any) => {
    setEditTrip(trip);
    setEditDialogOpen(true);
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditTrip({ ...editTrip, [e.target.name]: e.target.value });
  };
  const handleEditSelect = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    setEditTrip({ ...editTrip, [e.target.name as string]: e.target.value });
  };
  //Backend API call(updateTrip) to update trip details in database(Postgres, Trip table) and update in grid
  const handleEditSave = async () => {
    if (!editTrip) return;
    await fetch(`/api/trips/${editTrip.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftType: editTrip.shifttype,
        direction: editTrip.direction,
        driver: 'Kostile',
        tripDate: editTrip.trip_date,
        userUpdated: username
      })
    });
    fetch('/api/trips')
      .then(res => res.json())
      .then(data => setTrips(data.map((trip: any) => ({
        ...trip,
        id: trip.id,
        shiftType: trip.shifttype,
        tripDate: trip.trip_date,
        dateCaptured: trip.date_created,
        driver: trip.driver,
        direction: trip.direction,
        userCreated: trip.user_created || '',
        userUpdated: trip.user_updated || ''
      }))));
    setEditDialogOpen(false);
    setEditTrip(null);
  };
  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setEditTrip(null);
  };

  // Delete trip logic with confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTripId, setDeleteTripId] = useState<number | null>(null);
  const handleDeleteTripClick = (id: number) => {
    setDeleteTripId(id);
    setDeleteDialogOpen(true);
  };
  const handleDeleteTripConfirm = async () => {
    if (deleteTripId !== null) {
      await fetch(`/api/trips/${deleteTripId}`, { method: 'DELETE' });
      // Refresh trips from backend
      fetch('/api/trips')
        .then(res => res.json())
        .then(data => setTrips(data));
    }
    setDeleteDialogOpen(false);
    setDeleteTripId(null);
  };
  const handleDeleteTripCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteTripId(null);
  };

  function downloadBase64(base64: string, filename: string) {
    const blob = new Blob(
      [Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
      { type: "application/pdf" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  // Dashboard stats
const now = new Date();

  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  const thisMonth = today.substring(0, 7);
  const thisYear = today.substring(0, 4);
  const tripsToday = trips.filter(t => t.trip_date.startsWith(today)).length;
  const tripsMonth = trips.filter(t => t.trip_date.startsWith(thisMonth)).length;
  const tripsYear = trips.filter(t => t.trip_date.startsWith(thisYear)).length;

  // Month filter state
  const [filterMonth, setFilterMonth] = useState(thisMonth);
  const filteredTrips = trips.filter(trip => {
    if (!trip.trip_date) return false;
    return trip.trip_date.substring(0, 7) === filterMonth;
  });
  // Generate invoice by calling backend API and download PDF
  const handleGenerateInvoice = async () => {
    setInvoiceLoading(true);
    // Prepare invoice data for backend
    type SummaryRow = { label: string; qty: number; rate: number };
    const summary: Record<string, SummaryRow> = {};
    filteredTrips.forEach(trip => {
      const key = trip.shifttype;
      if (!summary[key]) {
        summary[key] = {
          label: shiftTypes.find(st => st.value === key)?.label || key,
          qty: 0,
          rate: trip.rate
        };
      }
      summary[key].qty += 1;
    });
    const invoiceRows = Object.values(summary).map(row => ({
      description: row.label,
      qty: row.qty,
      rate: row.rate
    }));
    const invoiceData = {
      invoiceNo: filterMonth,
      rows: invoiceRows
    };
    try {
      const response = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceData })
      });
      if (!response.ok) throw new Error('Failed to generate invoice');
      const data = await response.json();

      const emailSent = response.headers.get('X-Email-Sent');

      // Refresh invoices after generating invoice
      fetch('/api/invoices')
        .then(res => res.json())
        .then(data => setInvoices(data));

      if (emailSent === 'false') {
        downloadBase64(data.invoicePdf, "invoice.pdf");
        setSnackbar({
          open: true,
          message: 'Invoice downloaded, but email failed to send.',
          severity: 'warning'
        });

      } else {

        setSnackbar({
          open: true,
          message: 'Invoice generated and email sent successfully!',
          severity: 'success'
        });

      }
    } catch (err) {
      if (err instanceof Error) {
        setSnackbar({ open: true, message: 'Error generating invoice: ' + err.message, severity: 'error' });
      } else {
        setSnackbar({ open: true, message: 'Error generating invoice.', severity: 'error' });
      }
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Login screen
  if (!loggedIn) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', bgcolor: '#f5f5f5' }}>
        <CssBaseline />
        <Paper sx={{ p: 4, width: 320 }} elevation={3}>
          <Typography variant="h5" sx={{ mb: 2 }}>Login</Typography>
          <form onSubmit={handleLogin}>
            <TextField label="Username" fullWidth sx={{ mb: 2 }} value={username} onChange={e => setUsername(e.target.value)} />
            <TextField label="Password" type="password" fullWidth sx={{ mb: 2 }} value={password} onChange={e => setPassword(e.target.value)} />
            {error && (<Typography color="error" sx={{ mb: 2 }}>{error}</Typography>)}
            <Button type="submit" variant="contained" fullWidth>Login</Button>
          </form>
          <Button sx={{ mt: 2 }} variant="outlined" fullWidth onClick={() => setShowSignup(true)}>Create Account</Button>
          <Button sx={{ mt: 1 }} variant="text" fullWidth onClick={() => setShowForgotPassword(true)}>Forgot Password?</Button>
                {/* Forgot Password Modal */}
                <Dialog open={showForgotPassword} onClose={(_, reason) => {
                  if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
                  setShowForgotPassword(false);
                  setForgotStep(1);
                  setForgotEmail('');
                  setForgotCode('');
                  setForgotNewPassword('');
                  setForgotError('');
                }} maxWidth="xs" fullWidth>
                  <DialogTitle>Forgot Password</DialogTitle>
                  <DialogContent>
                    {forgotStep === 1 ? (
                      <form onSubmit={async e => {
                        e.preventDefault();
                        setForgotLoading(true);
                        setForgotError('');
                        try {
                          const res = await fetch('/api/request-password-reset', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ emailAddress: forgotEmail })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Failed to send reset code');
                          setForgotStep(2);
                          setSnackbar({ open: true, message: data.message, severity: 'info' });
                        } catch (err: any) {
                          setForgotError(err.message);
                        } finally {
                          setForgotLoading(false);
                        }
                      }}>
                        <TextField label="Email Address" type="email" fullWidth sx={{ mb: 2, mt: 2 }} value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                        {forgotError && (<Typography color="error" sx={{ mb: 2 }}>{forgotError}</Typography>)}
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                          <Button type="submit" variant="contained" fullWidth disabled={forgotLoading} startIcon={forgotLoading ? <CircularProgress size={20} color="inherit" /> : null}>
                            {forgotLoading ? 'Sending...' : 'Send Reset Code'}
                          </Button>
                          <Button variant="outlined" fullWidth color="secondary" onClick={() => setShowForgotPassword(false)}>Cancel</Button>
                        </Box>
                      </form>
                    ) : (
                      <form onSubmit={async e => {
                        e.preventDefault();
                        setForgotLoading(true);
                        setForgotError('');
                        try {
                          const res = await fetch('/api/reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ emailAddress: forgotEmail, code: forgotCode, newPassword: forgotNewPassword })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Failed to reset password');
                          setShowForgotPassword(false);
                          setForgotStep(1);
                          setForgotEmail('');
                          setForgotCode('');
                          setForgotNewPassword('');
                          setSnackbar({ open: true, message: data.message, severity: 'success' });
                        } catch (err: any) {
                          setForgotError(err.message);
                        } finally {
                          setForgotLoading(false);
                        }
                      }}>
                        <TextField label="Reset Code" fullWidth sx={{ mb: 2 }} value={forgotCode} onChange={e => setForgotCode(e.target.value)} required inputProps={{ maxLength: 6, pattern: '[0-9]{6}' }} />
                        <TextField label="New Password" type="password" fullWidth sx={{ mb: 2 }} value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} required />
                        {forgotError && (<Typography color="error" sx={{ mb: 2 }}>{forgotError}</Typography>)}
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                          <Button type="submit" variant="contained" fullWidth disabled={forgotLoading} startIcon={forgotLoading ? <CircularProgress size={20} color="inherit" /> : null}>
                            {forgotLoading ? 'Resetting...' : 'Reset Password'}
                          </Button>
                          <Button variant="outlined" fullWidth color="secondary" onClick={() => setShowForgotPassword(false)}>Cancel</Button>
                        </Box>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
        </Paper>
        {/* Signup Modal */}
        <Dialog open={showSignup} onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          setShowSignup(false);
        }} maxWidth="sm" fullWidth>
          <DialogTitle>Sign Up</DialogTitle>
          <DialogContent>
            <form onSubmit={handleSignupSubmit}>
              <TextField label="Name" name="name" fullWidth sx={{ mb: 2 }} value={signupForm.name} onChange={handleSignupChange} required />
              <TextField label="Surname" name="surname" fullWidth sx={{ mb: 2 }} value={signupForm.surname} onChange={handleSignupChange} required />
              <TextField label="Username" name="username" fullWidth sx={{ mb: 2 }} value={signupForm.username} onChange={handleSignupChange} required />
              <TextField label="Email Address" name="emailAddress" type="email" fullWidth sx={{ mb: 2 }} value={signupForm.emailAddress} onChange={handleSignupChange} required />
              <TextField label="Password" name="password" type="password" fullWidth sx={{ mb: 2 }} value={signupForm.password} onChange={handleSignupChange} required />
              {signupError && (<Typography color="error" sx={{ mb: 2 }}>{signupError}</Typography>)}
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button type="submit" variant="contained" fullWidth disabled={signupLoading} startIcon={signupLoading ? <CircularProgress size={20} color="inherit" /> : null}>
                    {signupLoading ? 'Signing Up...' : 'Sign Up'}
                  </Button>
                  <Button variant="outlined" fullWidth color="secondary" onClick={() => setShowSignup(false)}>Cancel</Button>
                </Box>
            </form>
          </DialogContent>
        </Dialog>
        {/* Email Confirmation Modal */}
        <Dialog open={showConfirmEmail} onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          setShowConfirmEmail(false);
        }} maxWidth="xs" fullWidth>
          <DialogTitle>Email Confirmation</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>Check your email for a 6-digit confirmation code and enter it below:</Typography>
            <form onSubmit={handleConfirmEmail}>
              <TextField label="Confirmation Code" fullWidth sx={{ mb: 2 }} value={confirmToken} onChange={e => setConfirmToken(e.target.value)} required inputProps={{ maxLength: 6, pattern: '[0-9]{6}' }} />
              {confirmError && (<Typography color="error" sx={{ mb: 2 }}>{confirmError}</Typography>)}
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button type="submit" variant="contained" fullWidth disabled={confirmLoading} startIcon={confirmLoading ? <CircularProgress size={20} color="inherit" /> : null}>
                  {confirmLoading ? 'Confirming...' : 'Confirm Email'}
                </Button>
                <Button variant="outlined" fullWidth color="secondary" onClick={() => setShowConfirmEmail(false)}>Cancel</Button>
              </Box>
            </form>
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  // Dashboard screen
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Transport Billing Dashboard</Typography>
          <Box sx={{ ml: 2 }}>
            <Button color="inherit" onClick={handleUserMenuOpen}>
              Menu
            </Button>
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={handleUserMenuClose}
            >
              <MenuItem disabled>{username || 'User'}</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5">Trips Today</Typography>
              <Typography variant="h3" color="primary">{tripsToday}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5">Trips This Month</Typography>
              <Typography variant="h3" color="primary">{tripsMonth}</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h5">Trips This Year</Typography>
              <Typography variant="h3" color="primary">{tripsYear}</Typography>
            </Paper>
          </Grid>
        </Grid>
        {/* Trip Capture Form */}
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Capture Trip</Typography>
          <form onSubmit={handleAddTrip}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  label="Shift Type"
                  name="shiftType"
                  fullWidth
                  value={tripForm.shiftType}
                  onChange={handleTripFormChange}
                  required
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {shiftTypes.map((st) => (
                    <MenuItem key={st.value} value={st.value}>
                      {st.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  label="Direction"
                  name="direction"
                  fullWidth
                  value={tripForm.direction}
                  onChange={handleTripFormChange}
                  required
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  <MenuItem value="To Work">To Work</MenuItem>
                  <MenuItem value="To Home">To Home</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="Trip Date"
                  name="tripDate"
                  type="date"
                  fullWidth
                  value={tripForm.tripDate}
                  onChange={handleTripFormChange}
                  InputLabelProps={{ shrink: true }}
                  required
                  inputRef={dateRef}
                  inputProps={{
                    max: new Date().toISOString().split("T")[0], // ✅ prevents future dates
                    style: { cursor: 'pointer' }
                  }}
                  onClick={() => dateRef.current?.showPicker()}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  label="Number of Trips"
                  name="quantity"
                  type="number"
                  fullWidth
                  value={tripForm.quantity}
                  onChange={handleTripFormChange}
                  inputProps={{ min: 1 }}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 12 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={addTripLoading}
                  startIcon={addTripLoading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {addTripLoading ? 'Adding...' : 'Add Trip'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
        {/* Trip List as DataGrid with Month Filter and Invoice Button */}
        <Paper sx={{ p: 3, mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
            <Typography variant="h6">Trips List</Typography>
            <TextField
              label="Filter by Month"
              type="month"
              size="small"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              sx={{ minWidth: 180 }}
              InputLabelProps={{ shrink: true }}
              inputRef={dateRefMonth}
              inputProps={{ style: { cursor: 'pointer' } }}
              onClick={() => dateRefMonth.current?.showPicker()}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={handleMenuClick}
              disabled={filteredTrips.length === 0 || invoiceLoading}
              startIcon={invoiceLoading ? <CircularProgress size={20} color="inherit" /> : null}
              aria-controls={openMenu ? 'generate-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={openMenu ? 'true' : undefined}
            >
              {invoiceLoading ? 'Generating...' : 'Generate'}
            </Button>
            <Menu
              id="generate-menu"
              anchorEl={anchorEl}
              open={openMenu}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => handleMenuSelect('invoice')}>Generate Invoice</MenuItem>
              <MenuItem onClick={() => handleMenuSelect('statement')}>Generate Statement</MenuItem>
            </Menu>
            <Dialog open={statementDialogOpen} onClose={(_, reason) => {
              if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
              setStatementDialogOpen(false);
            }} maxWidth="sm" fullWidth>
              <DialogTitle>Generate Statement</DialogTitle>
              <DialogContent>
                <Autocomplete
                  options={invoices}
                  getOptionLabel={inv => `INV${inv.invoice_no} - ${inv.invoice_date}`}
                  value={invoices.find(inv => inv.invoice_no === selectedInvoiceNo) || null}
                  onChange={(_, value) => setSelectedInvoiceNo(value ? value.invoice_no : '')}
                  renderInput={params => (
                    <TextField {...params} label="Select Invoice" fullWidth sx={{ mt: 2 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.invoice_no === value.invoice_no}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setStatementDialogOpen(false)} color="secondary">Cancel</Button>
                <Button onClick={handleGenerateStatement} color="primary" disabled={!selectedInvoiceNo || statementLoading}>
                  {statementLoading ? <CircularProgress size={20} color="inherit" /> : 'Generate'}
                </Button>
              </DialogActions>
            </Dialog>
                {/* Snackbar for invoice status */}
                <Snackbar
                  anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                  open={snackbar.open}
                  autoHideDuration={4000}
                  onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
                >
                  <Alert
                    onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
                    severity={snackbar.severity || "success"}
                    variant="filled"
                    sx={{
                      fontSize: '1.3rem',      // bigger font
                      alignItems: 'center',
                      minWidth: '300px'
                    }}
                  >
                    {snackbar.message}
                  </Alert>
                </Snackbar>
          </Box>
          <div style={{ width: '100%' }}>
            <DataGrid
              rows={filteredTrips.map((trip) => ({
                ...trip,
                shiftTypeLabel:
                  shiftTypes.find(st => st.value === trip.shifttype)?.label || '',
                rateDisplay: `R${Number(trip.rate)?.toFixed(2)}`,
                id: trip.id,
                trip_date: trip.trip_date.split('T')[0],
                userCreatedLabel: trip.userCreated,
                userUpdatedLabel: trip.userUpdated
              }))}
              columns={[
                { field: 'id', headerName: 'Trip ID', flex: 1 },
                { field: 'trip_date', headerName: 'Trip Date', flex: 1 },
                { field: 'shiftTypeLabel', headerName: 'Shift Type', flex: 1 },
                { field: 'direction', headerName: 'Direction', flex: 1 },
                { field: 'rateDisplay', headerName: 'Rate', flex: 1 },
                { field: 'userCreatedLabel', headerName: 'User Created', flex: 1 },
                { field: 'userUpdatedLabel', headerName: 'User Updated', flex: 1 },
                {
                  field: 'actions',
                  headerName: 'Actions',
                  sortable: false,
                  filterable: false,
                  flex: 1,
                  minWidth: 120,
                  renderCell: (params: any) => (
                    <>
                      <IconButton
                        color="primary"
                        onClick={() => handleEditClick(params.row)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteTripClick(params.row.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )
                }
              ] as GridColDef[]}
              getRowId={(row: any) => row.id}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 5,
                    page: 0
                  }
                }
              }}
              pageSizeOptions={[5, 10, 20]}
              disableRowSelectionOnClick
              sx={{ bgcolor: '#fff', borderRadius: 2 }}
              autoHeight
            />
          </div>
          {/* Delete Trip Confirmation Dialog */}
          <Dialog
            open={deleteDialogOpen}
            onClose={(_, reason) => {
              // Prevent closing on backdrop click and escape key
              if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
              handleDeleteTripCancel();
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
              <Typography>Are you sure you want to delete this trip?</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDeleteTripCancel}>Cancel</Button>
              <Button onClick={handleDeleteTripConfirm} color="error" variant="contained">Delete</Button>
            </DialogActions>
          </Dialog>
        </Paper>
        {/* Edit Trip Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={(_, reason) => {
            // Prevent closing on backdrop click and escape key
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
            handleEditCancel();
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogContent>
            {editTrip && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Date Captured"
                    name="date"
                    type="text"
                    fullWidth
                    value={editTrip.date_created}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Trip Date"
                  name="trip_date"
                  type="date"
                  fullWidth
                  value={editTrip.trip_date}
                  onChange={handleEditChange}
                  InputLabelProps={{ shrink: true }}
                  required
                  inputRef={dateRef}
                  inputProps={{
                    max: new Date().toISOString().split("T")[0], // ✅ prevents future dates
                    style: { cursor: 'pointer' }
                  }}
                  onClick={() => dateRef.current?.showPicker()}
                />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="Shift Type"
                    name="shifttype"
                    fullWidth
                    value={editTrip.shifttype}
                    onChange={handleEditChange}
                  >
                    <MenuItem value="">
                      <em>Select</em>
                    </MenuItem>
                    {shiftTypes.map(st => <MenuItem key={st.value} value={st.value}>{st.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    label="Direction"
                    name="direction"
                    fullWidth
                    value={editTrip.direction}
                    onChange={handleEditChange}
                  >
                    <MenuItem value="">
                      <em>Select</em>
                    </MenuItem>
                    <MenuItem value="To Work">To Work</MenuItem>
                    <MenuItem value="To Home">To Home</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditCancel}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

export default App;