'use strict';

const sinon = require('sinon');
const BbPromise = require('bluebird');
const path = require('path');
const expect = require('chai').expect;

const Serverless = require('../../../../Serverless');
const AwsDeploy = require('../');

describe('#configureStack', () => {
  let awsDeploy;
  let serverless;

  beforeEach(() => {
    serverless = new Serverless();
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    awsDeploy = new AwsDeploy(serverless, options);
    awsDeploy.serverless.cli = new serverless.classes.CLI();
  });

  it('should validate the region for the given S3 bucket', () => {
    const bucketName = 'com.serverless.deploys';

    const getBucketLocationStub = sinon
      .stub(awsDeploy.sdk, 'request').returns(
        BbPromise.resolve({ LocationConstraint: awsDeploy.options.region })
      );

    awsDeploy.serverless.service.provider.deploymentBucket = bucketName;
    return awsDeploy.configureStack()
      .then(() => {
        expect(getBucketLocationStub.args[0][0]).to.equal('S3');
        expect(getBucketLocationStub.args[0][1]).to.equal('getBucketLocation');
        expect(getBucketLocationStub.args[0][2].Bucket).to.equal(bucketName);
      });
  });

  it('should reject an S3 bucket in the wrong region', () => {
    const bucketName = 'com.serverless.deploys';

    const createStackStub = sinon
      .stub(awsDeploy.sdk, 'request').returns(
        BbPromise.resolve({ LocationConstraint: 'us-west-1' })
      );

    awsDeploy.serverless.service.provider.deploymentBucket = 'com.serverless.deploys';
    return awsDeploy.configureStack()
      .catch((err) => {
        expect(createStackStub.args[0][0]).to.equal('S3');
        expect(createStackStub.args[0][1]).to.equal('getBucketLocation');
        expect(createStackStub.args[0][2].Bucket).to.equal(bucketName);
        expect(err.message).to.contain('not in the same region');
      })
      .then(() => {});
  });

  it('should use a custom bucket if specified', () => {
    const bucketName = 'com.serverless.deploys';

    awsDeploy.serverless.service.provider.deploymentBucket = bucketName;

    const coreCloudFormationTemplate = awsDeploy.serverless.utils.readFileSync(
      path.join(
        __dirname,
        '..',
        'lib',
        'core-cloudformation-template.json'
      )
    );
    awsDeploy.serverless.service.provider
      .compiledCloudFormationTemplate = coreCloudFormationTemplate;

    sinon
      .stub(awsDeploy.sdk, 'request')
      .returns(BbPromise.resolve({ LocationConstraint: '' }));

    return awsDeploy.configureStack()
      .then(() => {
        expect(
          awsDeploy.serverless.service.provider.compiledCloudFormationTemplate
            .Outputs.ServerlessDeploymentBucketName.Value
        ).to.equal(bucketName);
        // eslint-disable-next-line no-unused-expressions
        expect(
          awsDeploy.serverless.service.provider.compiledCloudFormationTemplate
            .Resources.ServerlessDeploymentBucket
        ).to.not.exist;
      });
  });
});
