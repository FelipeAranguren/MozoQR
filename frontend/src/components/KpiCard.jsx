// src/components/KpiCard.jsx
import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";

export default function KpiCard({ title, value, subtitle, right }) {
  return (
    <Card elevation={0} sx={{ borderRadius: 3, background: "#fff" }}>
      <CardContent
        sx={{
          minHeight: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ mt: 0.5 }} color="success.main">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {right ? (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: "action.hover",
              display: "grid",
              placeItems: "center",
              minWidth: 48,
              minHeight: 48,
            }}
          >
            {right}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
