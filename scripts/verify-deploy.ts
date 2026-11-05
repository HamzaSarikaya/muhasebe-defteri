import {verifyDeployment} from '../lib/deployment';

verifyDeployment(process.env).then(() => {
  console.log('Deployment environment verified.');
}).catch(error => {
  console.error('Deployment stopped:', error instanceof Error ? error.message : 'Invalid environment.');
  process.exitCode = 1;
});
