'use strict';

/**
 * Module for chrismtmas tree public API
 * @module controllers/chrismtmas-tree
 */

const uuid = require('uuid/v4');
const xml2jsParse = require('xml2js').parseString;
const moment = require('moment-timezone');
const zpad = require('zpad');
const htmlToText = require('html-to-text');
const logger = require('../services/logger.es6');
const vcapConstants = require('../vcap-constants.es6');
const treesDb = require('../models/trees-db.es6');
const paygov = require('../services/paygov.es6');
const permitSvgService = require('../services/christmas-trees-permit-svg-util.es6');
const jwt = require('jsonwebtoken');
const email = require('../email/email-util.es6');
const forestService = require('../services/forest.service.es6');
const util = require('../services/util.es6');


const christmasTree = {};

/**
 * @function translatePermitFromClientToDatabase - Private function to translate request data to the database json object
 * @param {Object} input - christmas trees permit object from database
 * @return {Object} - formatted permit object
 */
const translatePermitFromClientToDatabase = input => {
  return {
    permitId: uuid(),
    forestId: input.forestId,
    orgStructureCode: input.orgStructureCode,
    firstName: input.firstName,
    lastName: input.lastName,
    emailAddress: input.emailAddress,
    treeCost: input.treeCost,
    quantity: input.quantity,
    totalCost: input.totalCost,
    permitExpireDate: input.expDate
  };
};

/**
 * @function getForests - API function to get all forests
 * @param {Object} req - http request
 * @param {Object} res - http response
 */
christmasTree.getForests = (req, res) => {
  treesDb.christmasTreesForests
    .findAll({
      attributes: ['id', 'forestName', 'forestNameShort', 'description', 'forestAbbr', 'startDate', 'endDate', 'timezone'],
      order: [['id', 'ASC']]
    })
    .then(results => {
      if (results) {
        res.status(200).json(results);
      } else {
        res.status(404).send();
      }
    })
    .catch(error => {
      res.status(400).json(error);
    });
};

/**
 * @function getForest - API function to get one forest by the forest abbreviation
 * @param {Object} req - http request
 * @param {Object} res - http response
 */
christmasTree.getForest = (req, res) => {
  treesDb.christmasTreesForests
    .findOne({
      where: {
        forestAbbr: req.params.id
      }
    })
    .then(app => {
      if (app) {
        res.status(200).json(forestService.translateForestFromDatabaseToClient(app));
      } else {
        res.status(404).send();
      }
    })
    .catch(error => {
      logger.error('ERROR: ServerError: christmasTree controller getForest error for forest abbr ' + req.params.id, error);
      res.status(400).json(error);
    });
};

/**
 * @function permitResult - Private function to return formatted permit result
 * @param {Object} permit - permit object from database
 * @return {Object} - formatted permit object
 */
const permitResult = permit => {
  return {
    permitId: permit.permitId,
    orgStructureCode: permit.orgStructureCode,
    firstName: permit.firstName,
    lastName: permit.lastName,
    emailAddress: permit.emailAddress,
    quantity: permit.quantity,
    totalCost: permit.totalCost,
    status: permit.status,
    transactionDate: permit.updatedAt,
    paygovTrackingId: permit.paygovTrackingId,
    expirationDate: permit.permitExpireDate,
    permitNumber: zpad(permit.permitNumber, 8),
    forest: {
      forestName: permit.christmasTreesForest ? permit.christmasTreesForest.forestName : null,
      forestAbbr: permit.christmasTreesForest ? permit.christmasTreesForest.forestAbbr : null,
      forestNameShort: permit.christmasTreesForest ? permit.christmasTreesForest.forestNameShort : null
    }
  };
};

/**
 * @function updatePermitWithToken - Private function to update permit with paygov token
 * @param {Object} res - http response
 * @param {Object} permit - permit from database
 * @param {string} token - paygov token
 * @return {Object} - http response
 */
const updatePermitWithToken = (res, permit, token) => {
  const tcsAppID = vcapConstants.PAY_GOV_APP_ID;
  permit
    .update({
      paygovToken: token
    })
    .then(savedPermit => {
      logger.info(
        `${savedPermit.emailAddress} modified ${savedPermit.permitId} with pay.gov token at ${savedPermit.updatedAt}`
      );
      return res.status(200).json({
        token: token,
        permitId: savedPermit.permitId,
        payGovUrl: vcapConstants.PAY_GOV_CLIENT_URL,
        tcsAppID: tcsAppID
      });
    })
    .catch(error => {
      util.handleErrorResponse(error, res, 'updatePermitWithToken#end');
    });
};

/**
 * @function updatePermitWithError - Private function to update permit's status to error
 * @param {Object} res - http response
 * @param {Object} permit - permit object from database
 * @param {string} paygovError - error from payGov
 * @return {Object} - http response
 */
const updatePermitWithError = (res, permit, paygovError) => {
  return updatePermit(permit, {
    status: 'Error',
    paygovError: JSON.stringify(paygovError)
  }).then(updatedPermit => {
    logger.error(
      `ERROR: ServerError: ${updatedPermit.emailAddress} \
modified ${updatedPermit.permitId} encountered an error \
at pay.gov ${updatedPermit.paygovError}`
    );
    return getPermitError(res, updatedPermit);
  });
};

/**
 * @function getPermitError - Private function to error objects from the permit's errors
 * @param {Object} res - http response
 * @param {Object} permit - permit object from database
 * @return {Object} - http response
 */
const getPermitError = (res, permit) => {
  let permitErrors = JSON.parse(permit.paygovError);
  return res.status(400).json({
    errors: [
      {
        status: 400,
        errorCode: permitErrors.errorCode[0],
        message: permitErrors.errorMessage[0],
        permit: permitResult(permit)
      }
    ]
  });
};

/**
 * @function recordPayGovError - Private function to error objects from the permit's errors
 * @param {Object} error - no valid token error from gettoken
 * @param {Object} result - xmlpaygov pa
 * @param {Object} permit - permit object from database
 * @param {Object} res - http response
 * @param {String} requestType - the name of the request when the error occured
 * @return {Object} - promise of whether permit was updated with token
 */
const recordPayGovError = (error, result, res, permit, requestType) => {
  logger.error(`ERROR: ServerError: Pay.gov- ${error}. Updating permit with error while ${requestType}`);
  return paygov.getResponseError(requestType, result)
    .then(paygovError => {
      return updatePermitWithError(res, permit, paygovError);
    });
};

/**
 * @function grabAndProcessPaygovToken - Private function to error objects from the permit's errors
 * @param {Object} xmlDatafromPayGov - xml from pay.gov 
 * @param {Object} permit - permit object from database
 * @param {Object} res - http response
 * @return {Object} - promise of whether permit was updated with token
 */
const grabAndProcessPaygovToken = (payGovXmlRes, permit, res) => {
  return new Promise((resolve, reject) => {
    xml2jsParse(payGovXmlRes, function (parseErr, result) {
      if (!parseErr) {
        paygov.getToken(result)
          .then(token => resolve(updatePermitWithToken(res, permit, token)))
          .catch(error => {
            return recordPayGovError(error, result, res, permit, 'startOnlineCollection');
          });
      }
      reject(parseErr);
    });
  });
};

/**
 * @function create - API function to create permit application
 * @param {Object} req - http request
 * @param {Object} res - http response
 * @return {Object} http response
 */
christmasTree.create = (req, res) => {
  treesDb.christmasTreesForests
    .findOne({
      where: {
        id: req.body.forestId
      }
    })
    .then(forest => {
      if (!moment().isBetween(forest.startDate, forest.endDate, null, '[]')) {
        logger.error('Permit attempted to be created outside of season date for ${req.body.forestId}');
        return res.status(404).send(); // season is closed or not yet started
      } else {
        req.body.expDate = forest.endDate;
        return treesDb.christmasTreesPermits
          .create(translatePermitFromClientToDatabase(req.body))
          .then(permit => {
            util.logControllerAction(req, 'christmasTree.create', permit);
            return paygov.getXmlForToken(forest.forestAbbr, forest.possFinancialId, permit)
              .then(initPayGovTransactionXml => paygov.postPayGov(initPayGovTransactionXml)
                .then(xmlResponse => grabAndProcessPaygovToken(xmlResponse, permit, res))
                .catch(postError => {
                  if (postError && postError !== 'null') {
                    util.handleErrorResponse(postError, res, 'create#postPay');
                  }
                })
              );
          });
      }
    })
    .catch(error => {
      logger.error(`ERROR: ServerError: ${error} from create#catch`);
      return res.status(400).json({
        errors: error.errors
      });
    });
};

/**
 * @function sendEmail - Private function to send email with the input data
 * @param {Object} savedPermit - permit object from database
 * @param {string} permitPng - permit's png buffer
 * @param {string} rulesHtml - permit rules in html format
 * @param {string} rulesText - permit rules in text format
 */
const sendEmail = (savedPermit, permitPng, rulesHtml, rulesText) => {
  const attachments = [
    {
      filename: 'permit.png',
      content: new Buffer(permitPng, 'utf-8'),
      cid: 'christmas-tree-permit-image'
    },
    {
      filename: 'permit-attachment.png',
      content: new Buffer(permitPng, 'utf-8')
    },
    {
      filename: 'permit-rules.html',
      content: new Buffer(rulesHtml, 'utf-8'),
      contentType: 'text/html'
    },
    {
      filename: 'permit-rules.txt',
      content: new Buffer(rulesText, 'utf-8')
    }
  ];
  email.sendEmail('christmasTreesPermitCreated', savedPermit, attachments);
};

/**
 * @function returnSavedPermit - Private function to return permit
 * @param {Object} res - http response
 * @param {Object} savedPermit - permit from database
 * @return {Object} - http response
 */
const returnSavedPermit = (res, savedPermit) => {
  return res.status(200).send(permitResult(savedPermit));
};

/**
 * @function updatePermit - Private function to update permit in database
 * @param {Object} permit - permit object from database
 * @param {Object} updateObject - updated permit object
 * @return {Object} - saved permit
 */
const updatePermit = (permit, updateObject) => {
  return new Promise((resolve, reject) => {
    permit
      .update(updateObject)
      .then(permit => {
        logger.info(
          `PermitID ${permit.permitId} created at ${permit.modifiedAt} by ${permit.emailAddress} `
        );
        resolve(permit);
      })
      .catch(error => {
        reject(error);
      });
  });
};

/**
 * @function parseXMLFromPayGov - Private function to parse the returned XML from payGov
 * @param {Object} res - http response
 * @param {string} payGovXmlRes - xml response from payGov api call
 * @param {Object} permit - permit object
 * @return {string} - paygov tracking id
 */
const grabAndProcessTrackingId = (res, payGovXmlRes, permit) => {
  return new Promise((resolve, reject) => {
    xml2jsParse(payGovXmlRes, function (parseErr, result) {
      if (!parseErr) {
        paygov.getTrackingId(result)
          .then(token => resolve(updatePermitWithToken(res, permit, token)))
          .catch(error => {
            return recordPayGovError(error, result, res, permit, 'completeOnlineCollection');
          });
      } else {
        reject(parseErr);
      }
    });
  });
};

/**
 * @function permitExpireDate - Private function to check if permit expire date is in future
 * @param {date} permitExpireDate - expiration date
 * @return {boolean} - expiration date is is after current date
 */
const checkPermitValid = permitExpireDate => {
  return moment(permitExpireDate).isAfter(moment());
};

/**
 * @function generateRulesAndEmail - Private function to generate svg, png, and rules html of a permit and send out email
 * @param {Object} permit - permit object
 */
christmasTree.generateRulesAndEmail = permit =>
  permitSvgService
    .generatePermitSvg(permit)
    .then((permitSvg) => Promise.all([
      permitSvgService.generatePng(permitSvg),
      permitSvgService.generateRulesHtml(true, permit),
    ]))
    .then(([permitPng, rulesHtml]) => {
      permit.permitUrl = paygov.returnUrl(
        permit.christmasTreesForest.forestAbbr,
        permit.permitId,
        false
      );
      const rulesText = htmlToText.fromString(rulesHtml, {
        wordwrap: 130,
        ignoreImage: true
      });
      return sendEmail(permit, permitPng, rulesHtml, rulesText);
    })
    .catch(error => {
      logger.error(error);
    });

/**
 * @function getOnePermit - API function to get a permit.
 * @param {Object} req - http request
 * @param {Object} res - http response
 * @return {Object} - saved permit object
 */
christmasTree.getOnePermit = (req, res) => {
  treesDb.christmasTreesPermits
    .findOne({
      where: {
        permitId: req.params.id
      },
      include: [
        {
          model: treesDb.christmasTreesForests
        }
      ]
    })
    .then(permit => {
      if (permit && permit.status === 'Error') {
        return getPermitError(res, permit);
      } else if (permit) {
        const token = req.query.t;
        jwt.verify(token, vcapConstants.PERMIT_SECRET, function(err, decoded) {
          if (decoded) {
            util.logControllerAction(req, 'christmasTree.getOnePermit', permit);
            returnSavedPermit(res, permit);
          } else {
            return res.status(404).send();
          }
        });
      } else if (!permit) {
        return res.status(404).send();
      }
    })
    .catch(error => {
      util.handleErrorResponse(error, res, 'getOnePermit#end');
    });
};

/**
 * @function printPermit - API function to get permit svg or rules html
 * @param {Object} req - http request
 * @param {Object} res - http response
 * @return {Object} http reponse with permit svg or riles html
 */
christmasTree.printPermit = (req, res) => {
  treesDb.christmasTreesPermits
    .findOne({
      where: {
        permitId: req.params.id
      },
      include: [
        {
          model: treesDb.christmasTreesForests
        }
      ]
    })
    .then(permit => {
      util.logControllerAction(req, 'christmasTree.printPermit', permit);
      if (permit.status === 'Completed') {
        if (!checkPermitValid(permit.permitExpireDate)) {
          res.status(404).send();
        } else if (!req.query.rules || req.query.permit === 'true') {
          permitSvgService.generatePermitSvg(permit).then(permitSvg => {
            res.status(200).json({
              result: permitSvg
            });
          });
        } else if (req.query.rules === 'true') {
          permitSvgService.generateRulesHtml(false, permit).then(rulesHtml => {
            res.status(200).json({
              result: rulesHtml
            });
          });
        } else {
          res.status(404).send();
        }
      } else {
        res.status(404).send();
      }
    })
    .catch(error => {
      logger.error(error);
      res.status(404).send();
    });
};

const completePermitTransaction = (permit, res, req) => {
  util.logControllerAction(req, 'christmasTree.completePermitTransaction', permit);
  const xmlData = paygov.getXmlToCompleteTransaction(permit.paygovToken);
  paygov.postPayGov(xmlData)
    .then(xmlResponse => {
      return grabAndProcessTrackingId(res, xmlResponse, permit)
        .then((paygovTrackingId) => updatePermit(permit, {
          paygovTrackingId: paygovTrackingId,
          status: req.body.status
        })
          .then(updatedPermit => {
            returnSavedPermit(res, permit);
            christmasTree.generateRulesAndEmail(updatedPermit);
          })
          .catch(processErr => util.handleErrorResponse(processErr, res, 'completePermitTransaction#process'))
        );
    })
    .catch(postError => {
      if (postError && postError !== 'null') {
        util.handleErrorResponse(postError, res, 'completePermitTransaction#end');
      }
    });
};

/**
 * @function updatePermitApplication - API function to update permit
 * @param {Object} req - http request
 * @param {Object} res - http response
 * @return {Object} - updated permit
 */
christmasTree.updatePermitApplication = (req, res) => {
  treesDb.christmasTreesPermits
    .findOne({
      where: {
        permitId: req.body.permitId
      },
      include: [
        {
          model: treesDb.christmasTreesForests
        }
      ]
    })
    .then(permit => {
      const token = req.query.t;
      jwt.verify(token, vcapConstants.PERMIT_SECRET, function(err, decoded) {
        if (decoded && permit) {
          if (permit.status === 'Initiated' && req.body.status === 'Cancelled') {
            return permit
              .update({
                status: req.body.status
              })
              .then((permit)=>{
                util.logControllerAction(req, 'christmasTree.updatePermitApplication#cancel', permit);
                res.status(200).json(permit);
              });
          } else if (permit.status === 'Initiated' && req.body.status === 'Completed') {
            completePermitTransaction(permit, res, req);
          } else {
            if (permit.status === 'Error'){
              getPermitError(res, permit);
            }
            logger.error('Permit status unknown. 400.');
            return res.status(404).send();
          }
        } else {
          logger.error('Permit not loaded or JWT not decoded.');
          return res.status(404).send();
        }
      });
    })
    .catch((error) => {
      util.handleErrorResponse(error, res, 'updatePermit#end');
    });
};

module.exports = christmasTree;
