import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import RestaurantMenu from './RestaurantMenu';
import RestaurantMenuV1 from './RestaurantMenu_v1';
import { fetchRestaurantMenuDesign } from '../api/menuDesign';

export default function RestaurantMenuEntry() {
  const { slug } = useParams();
  const [menuDesign, setMenuDesign] = useState('v2');

  useEffect(() => {
    let cancelled = false;
    fetchRestaurantMenuDesign(slug).then((value) => {
      if (!cancelled) setMenuDesign(value);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (menuDesign === 'v1') return <RestaurantMenuV1 />;
  return <RestaurantMenu />;
}
