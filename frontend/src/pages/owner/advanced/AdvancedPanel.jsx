// frontend/src/pages/owner/advanced/AdvancedPanel.jsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Grid,
  Divider,
  Alert
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import PlanGate from '../../../components/PlanGate';
import { useRestaurantPlan } from '../../../hooks/useRestaurantPlan';
import ExportPanel from './ExportPanel';
import AuditLogsPanel from './AuditLogsPanel';
import TasksPanel from './TasksPanel';
import ViewModePanel from './ViewModePanel';
import SettingsIcon from '@mui/icons-material/Settings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HistoryIcon from '@mui/icons-material/History';
import TaskIcon from '@mui/icons-material/Task';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdvancedPanel() {
  const { slug } = useParams();
  const { plan, loading: planLoading } = useRestaurantPlan(slug);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (planLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Typography>Cargando...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <PlanGate plan={plan} requiredPlan="ULTRA" slug={slug}>
      <Container maxWidth="xl" sx={{ py: 3, background: MARANA_COLORS.background, minHeight: '100vh' }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <SettingsIcon sx={{ fontSize: 40, color: MARANA_COLORS.primary }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Panel Avanzado
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Funcionalidades avanzadas para gestión completa de tu negocio
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 64
                },
                '& .Mui-selected': {
                  color: MARANA_COLORS.primary
                }
              }}
            >
              <Tab
                icon={<FileDownloadIcon />}
                iconPosition="start"
                label="Exportaciones"
              />
              <Tab
                icon={<HistoryIcon />}
                iconPosition="start"
                label="Logs y Auditorías"
              />
              <Tab
                icon={<TaskIcon />}
                iconPosition="start"
                label="Tareas"
              />
              <Tab
                icon={<ViewModuleIcon />}
                iconPosition="start"
                label="Vista Operativa/Ejecutiva"
              />
            </Tabs>
          </Box>

          <CardContent sx={{ p: 3 }}>
            <TabPanel value={tabValue} index={0}>
              <ExportPanel slug={slug} />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <AuditLogsPanel slug={slug} />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TasksPanel slug={slug} />
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <ViewModePanel slug={slug} />
            </TabPanel>
          </CardContent>
        </Card>
      </Container>
    </PlanGate>
  );
}