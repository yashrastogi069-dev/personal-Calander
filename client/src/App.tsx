import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { AuthenticatedPlanner } from "./components/AuthenticatedPlanner";
import { Analytics } from "@vercel/analytics/react";
import { sanitizeAnalyticsEvent } from "./lib/deploymentAnalytics";
import PwaStatus from "./components/PwaStatus";
import { lazy, Suspense } from "react";

import CalendarExecution from "./pages/CalendarExecution";

const Phase4Prototypes = lazy(() => import("./pages/Phase4Prototypes"));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/phase4-prototypes"}>
        <Suspense fallback={<div role="status" aria-live="polite">Loading prototype…</div>}>
          <Phase4Prototypes />
        </Suspense>
      </Route>
      <Route path={"/calendar"}><CalendarExecution /></Route>
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable>
        <TooltipProvider>
          <Toaster />
          <PwaStatus />
          <AuthenticatedPlanner><Router /></AuthenticatedPlanner>
          <Analytics beforeSend={sanitizeAnalyticsEvent} />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
