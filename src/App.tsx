import { Router, Route } from '@solidjs/router'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import ApiDocs from './pages/ApiDocs'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Share from './pages/Share'
import TestWysiwyg from './pages/TestWysiwyg'

export default function App() {
  return (
    <Router>
      <Route path="/" component={MainLayout}>
        <Route path="/" component={Home} />
        <Route path="/api-docs" component={ApiDocs} />
        <Route path="/settings" component={Settings} />
        <Route path="/login" component={Login} />
        <Route path="/test-wysiwyg" component={TestWysiwyg} />
      </Route>
      <Route path="/share/:id" component={Share} />
    </Router>
  )
}
