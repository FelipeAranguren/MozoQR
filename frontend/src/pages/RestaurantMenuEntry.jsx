import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import RestaurantMenu from './RestaurantMenu';
import RestaurantMenuV1 from './RestaurantMenu_v1';
import { fetchRestaurantMenuDesign } from '../api/menuDesign';

export default function RestaurantMenuEntry() {
  const { slug } = useParams();
  /** null = aún no sabemos si es v1 o v2; evita montar el menú equivocado y luego remontar (doble fetch del selector de mesas). */
  const [menuDesign, setMenuDesign] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setMenuDesign(null);
    fetchRestaurantMenuDesign(slug).then((value) => {
      if (!cancelled) setMenuDesign(value);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (menuDesign === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }} aria-busy="true" aria-label="Cargando menú">
        <CircularProgress />
      </Box>
    );
  }

  if (menuDesign === 'v1') return <RestaurantMenuV1 />;
  return <RestaurantMenu />;
}
