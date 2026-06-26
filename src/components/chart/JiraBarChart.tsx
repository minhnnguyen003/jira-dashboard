'use client';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, type ChartData, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { JiraGroupedData } from '@/types/jira';
import { useLanguage } from '@/lib/i18n';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface JiraBarChartProps {
  data: JiraGroupedData[];
  groupBy: string;
  chartKey?: number;
  activeLabel?: string | null;
  onBarClick?: (label: string) => void;
}

export default function JiraBarChart({ data, groupBy, chartKey, activeLabel, onBarClick }: JiraBarChartProps) {
  const { t } = useLanguage();
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const chartData: ChartData<'bar'> = {
    labels: data.map((item) => item.label),
    datasets: [
      {
        label: t('chart.estimated'),
        data: data.map((item) => item.estimatedSeconds),
        backgroundColor: data.map((item) => item.label === activeLabel ? (isLight ? 'rgba(99,102,241,0.9)' : 'rgba(164,148,245,0.95)') : (isLight ? 'rgba(124,111,240,0.65)' : 'rgba(164,148,245,0.7)')),
        borderColor: isLight ? 'rgba(124,111,240,0.9)' : 'rgba(164,148,245,0.9)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: t('chart.logged'),
        data: data.map((item) => item.loggedSeconds),
        backgroundColor: data.map((item) => item.label === activeLabel ? (isLight ? 'rgba(45,166,110,0.9)' : 'rgba(109,212,158,0.95)') : (isLight ? 'rgba(59,183,127,0.65)' : 'rgba(109,212,158,0.7)')),
        borderColor: isLight ? 'rgba(59,183,127,0.9)' : 'rgba(109,212,158,0.9)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1400,
      easing: 'easeOutQuart',
      delay: (ctx) => (ctx.dataIndex || 0) * 100,
    },
    onHover: (event, elements) => {
      if (event.native?.target instanceof HTMLElement) {
        event.native.target.style.cursor = elements.length > 0 && onBarClick ? 'pointer' : 'default';
      }
    },
    onClick: (_event, elements) => {
      if (!onBarClick || elements.length === 0) return;
      const label = data[elements[0].index]?.label;
      if (label) onBarClick(label);
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: isLight ? '#6b7080' : '#8d919c',
          font: { size: 11 },
          padding: 14,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      title: {
        display: true,
        text: t('chart.title', { groupBy: groupBy.charAt(0).toUpperCase() + groupBy.slice(1) }),
        color: isLight ? '#2a2e3a' : '#e6e8ec',
        font: { size: 13, weight: 'bold' },
        padding: { top: 8, bottom: 12 },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(17,20,28,0.9)',
        titleColor: isLight ? '#1a1d26' : '#e6e8ec',
        bodyColor: isLight ? '#5a6070' : '#8d919c',
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const hours = Math.round(Number(ctx.raw) / 3600);
            return `${ctx.dataset.label}: ${hours}h`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: isLight ? '#6b7080' : '#8d919c', font: { size: 10 } },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: isLight ? '#6b7080' : '#8d919c',
          font: { size: 10 },
          callback: (value) => `${Math.round(Number(value) / 3600)}h`,
        },
        grid: { color: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' },
        border: { display: false },
      },
    },
  };

  return (
    <div className="glass-card-subtle p-5 h-full min-h-[360px]">
      <Bar key={chartKey} data={chartData} options={options} />
    </div>
  );
}




