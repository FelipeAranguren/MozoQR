// frontend/src/pages/owner/advanced/TasksPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { MARANA_COLORS } from '../../../theme';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { fetchTasks, createTask, updateTask, deleteTask } from '../../../api/tasks';

export default function TasksPanel({ slug }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  });

  useEffect(() => {
    loadTasks();
  }, [slug]);

  const loadTasks = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const data = await fetchTasks(slug);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      await updateTask(slug, taskId, { completed: !task.completed });
      await loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(slug, taskId);
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      await createTask(slug, newTask);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
      setOpenDialog(false);
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error al crear la tarea');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return MARANA_COLORS.accent;
      case 'medium': return MARANA_COLORS.secondary;
      case 'low': return MARANA_COLORS.primary;
      default: return MARANA_COLORS.textSecondary;
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sistema de Tareas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            bgcolor: MARANA_COLORS.primary,
            '&:hover': {
              bgcolor: MARANA_COLORS.primary,
              opacity: 0.9
            }
          }}
        >
          Nueva Tarea
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Organiza y gestiona tareas importantes para tu restaurante. Marca como completadas cuando las finalices.
        Las tareas se guardan localmente en tu navegador.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: MARANA_COLORS.primary }} />
        </Box>
      ) : (
        <>
          {/* Tareas pendientes */}
      <Card sx={{ mb: 3, border: `1px solid ${MARANA_COLORS.border}` }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Pendientes ({pendingTasks.length})
          </Typography>
          {pendingTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No hay tareas pendientes
            </Typography>
          ) : (
            <List>
              {pendingTasks.map((task) => (
                <ListItem
                  key={task.id}
                  sx={{
                    border: `1px solid ${MARANA_COLORS.border}`,
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: 'background.paper'
                  }}
                >
                  <Checkbox
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task.id)}
                    icon={<RadioButtonUncheckedIcon />}
                    checkedIcon={<CheckCircleIcon />}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {task.title}
                        </Typography>
                        <Chip
                          label={task.priority}
                          size="small"
                          sx={{
                            bgcolor: `${getPriorityColor(task.priority)}15`,
                            color: getPriorityColor(task.priority),
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}
                        />
                        {task.dueDate && (
                          <Typography variant="caption" color="text.secondary">
                            Vence: {new Date(task.dueDate).toLocaleDateString('es-AR')}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={task.description}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleDelete(task.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Tareas completadas */}
      {completedTasks.length > 0 && (
        <Card sx={{ border: `1px solid ${MARANA_COLORS.border}` }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Completadas ({completedTasks.length})
            </Typography>
            <List>
              {completedTasks.map((task) => (
                <ListItem
                  key={task.id}
                  sx={{
                    border: `1px solid ${MARANA_COLORS.border}`,
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: 'background.paper',
                    opacity: 0.7
                  }}
                >
                  <Checkbox
                    checked={task.completed}
                    onChange={() => handleToggleComplete(task.id)}
                    icon={<RadioButtonUncheckedIcon />}
                    checkedIcon={<CheckCircleIcon />}
                  />
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ textDecoration: 'line-through' }}>
                        {task.title}
                      </Typography>
                    }
                    secondary={task.description}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleDelete(task.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* Dialog para nueva tarea */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nueva Tarea</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Título"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Descripción"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Prioridad"
            select
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            SelectProps={{ native: true }}
            sx={{ mb: 2 }}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </TextField>
          <TextField
            fullWidth
            label="Fecha de vencimiento"
            type="date"
            value={newTask.dueDate}
            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAddTask}
            sx={{
              bgcolor: MARANA_COLORS.primary,
              '&:hover': {
                bgcolor: MARANA_COLORS.primary,
                opacity: 0.9
              }
              }}
          >
            Agregar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
