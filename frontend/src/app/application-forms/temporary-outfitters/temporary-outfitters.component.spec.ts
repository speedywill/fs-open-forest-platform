import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertService } from '../../_services/alert.service';
import { AuthenticationService } from '../../_services/authentication.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import * as sinon from 'sinon';
import { TemporaryOutfittersComponent } from './temporary-outfitters.component';
import { ApplicationService } from '../../_services/application.service';
import { ApplicationFieldsService } from '../_services/application-fields.service';
import { Observable } from 'rxjs/Observable';
import { RouterTestingModule } from '@angular/router/testing';
import { FormGroup, FormControl, FormArray, FormBuilder, Validators } from '@angular/forms';
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from '@angular/http';
import { tempOutfitterMock } from './temp-outfitter-mock';

describe('TemporaryOutfittersComponent', () => {
  let component: TemporaryOutfittersComponent;
  let fixture: ComponentFixture<TemporaryOutfittersComponent>;

  beforeEach(
    async(() => {
      TestBed.configureTestingModule({
        declarations: [TemporaryOutfittersComponent],
        schemas: [NO_ERRORS_SCHEMA],
        providers: [
          { provide: ApplicationService, useClass: MockApplicationService },
          { provide: ApplicationFieldsService, useClass: ApplicationFieldsService },
          { provide: FormBuilder, useClass: FormBuilder },
          AlertService,
          AuthenticationService
        ],
        imports: [RouterTestingModule, HttpModule]
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(TemporaryOutfittersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function createFakeEvent(type: string) {
    const event = document.createEvent('Event');
    event.initEvent(type, true, true);
    return event;
  }

  function dispatchFakeEvent(type: string) {
    window.dispatchEvent(createFakeEvent(type));
  }

  it('Should switch on org type', () => {
    const orgTypes = {
      Person: {
        pointOfView: 'I',
        orgTypeFileUpload: false,
        goodStandingEvidence: null
      },
      Corporation: {
        pointOfView: 'We',
        orgTypeFileUpload: true,
        goodStandingEvidence: [Validators.required]
      },
      'Limited Liability Company (LLC)': {
        pointOfView: 'We',
        orgTypeFileUpload: true,
        goodStandingEvidence: [Validators.required]
      },
      'Limited Liability Partnership (LLP)': {
        pointOfView: 'We',
        orgTypeFileUpload: true,
        goodStandingEvidence: [Validators.required]
      },
      'State Government': {
        pointOfView: 'We',
        orgTypeFileUpload: false,
        goodStandingEvidence: null
      },
      'Local Govt': {
        pointOfView: 'We',
        orgTypeFileUpload: false,
        goodStandingEvidence: null
      },
      Nonprofit: {
        pointOfView: 'We',
        orgTypeFileUpload: true,
        goodStandingEvidence: [Validators.required]
      }
    };
    for (const type of Object.keys(orgTypes)) {
      const orgFields = orgTypes[type];

      const get = sinon.stub(component.applicationForm, 'get').returns({
        setValidators: required => {
          expect(required).toEqual(orgFields.goodStandingEvidence);
        }
      });
      component.orgTypeChange(type);
      expect(component.pointOfView).toEqual(orgFields.pointOfView);
      expect(component.orgTypeFileUpload).toEqual(orgFields.orgTypeFileUpload);
      get.restore();
    }
  });

  it('should toggle advertising description', () => {
    component.applicationForm.get('tempOutfitterFields.advertisingURL').setValue('http://www.test.com');
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').valid).toBeTruthy();
    component.applicationForm.get('tempOutfitterFields.advertisingURL').setValue('');
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').valid).toBeFalsy();
    component.advertisingRequirementToggle(
      true,
      component.applicationForm.get('tempOutfitterFields.advertisingURL'),
      component.applicationForm.get('tempOutfitterFields.advertisingDescription')
    );
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').valid).toBeTruthy();
    expect(component.applicationForm.get('tempOutfitterFields.advertisingDescription').valid).toBeFalsy();
    component.applicationForm.get('tempOutfitterFields.advertisingDescription').setValue('test');
    expect(component.applicationForm.get('tempOutfitterFields.advertisingDescription').valid).toBeTruthy();
    component.advertisingRequirementToggle(
      false,
      component.applicationForm.get('tempOutfitterFields.advertisingURL'),
      component.applicationForm.get('tempOutfitterFields.advertisingDescription')
    );
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').valid).toBeFalsy();
  });

  it('matchUrls should not copy url on empty value', () => {
    const get = sinon.stub(component.applicationForm, 'get');
    const spy = sinon.spy();
    get.withArgs('applicantInfo.website').returns({ value: '' });
    get.withArgs('tempOutfitterFields.advertisingURL').returns({ value: '', setValue: spy });
    component.matchUrls();
    expect(spy.notCalled).toBeTruthy();
    get.restore();
  });

  it('matchUrls should not copy url on url value when ad url has value', () => {
    const get = sinon.stub(component.applicationForm, 'get');
    const spy = sinon.spy();
    get.withArgs('applicantInfo.website').returns({ value: 'http://www.google.com' });
    get.withArgs('tempOutfitterFields.advertisingURL').returns({ value: 'www.google.com', setValue: spy });
    component.matchUrls();
    expect(spy.called).toBeFalsy();
    get.restore();
  });

  it('should not copy url if url is not valid, and copy url if url is valid', () => {
    component.applicationForm.get('applicantInfo.website').setValue('test');
    component.matchUrls();
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').value).toBe('');
    component.applicationForm.get('applicantInfo.website').setValue('http://www.test.com');
    component.matchUrls();
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').value).toBe('http://www.test.com');
    component.applicationForm.get('applicantInfo.website').setValue('test');
    component.matchUrls();
    expect(component.applicationForm.get('tempOutfitterFields.advertisingURL').value).toBe('http://www.test.com');
  });

  it('should not submit if form not valid', () => {
    component.checkFileUploadValidity = () => {};
    component.applicationForm = component.formBuilder.group({
      liabilityInsurance: ['', [Validators.required]]
    });

    component.dateStatus.hasErrors = false;
    component.invalidFileUpload = false;
    const spy = sinon.spy(component.applicationFieldsService, 'scrollToFirstError');
    const spyPass = sinon.spy(component.applicationService, 'create');

    component.onSubmit();
    expect(spy.called).toBeTruthy();
    expect(spyPass.called).toBeFalsy();
  });

  it('should not submit if date has errors', () => {
    component.checkFileUploadValidity = () => {};
    component.applicationForm = component.formBuilder.group({
      liabilityInsurance: ['', [Validators.required]]
    });
    component.applicationForm.controls['liabilityInsurance'].setValue('meow mix');
    component.dateStatus.hasErrors = true;
    component.invalidFileUpload = false;
    const spyFail = sinon.spy(component.applicationFieldsService, 'scrollToFirstError');
    const spyPass = sinon.spy(component.applicationService, 'create');

    component.onSubmit();
    expect(spyFail.called).toBeTruthy();
    expect(spyPass.called).toBeFalsy();
  });

  it('should not submit if file is invalid', () => {
    component.checkFileUploadValidity = () => {};
    component.applicationForm = component.formBuilder.group({
      liabilityInsurance: ['', [Validators.required]]
    });
    component.applicationForm.controls['liabilityInsurance'].setValue('meow mix');
    component.dateStatus.hasErrors = false;
    component.invalidFileUpload = true;
    const spyFail = sinon.spy(component.applicationFieldsService, 'scrollToFirstError');
    const spyPass = sinon.spy(component.applicationService, 'create');

    component.onSubmit();
    expect(spyFail.called).toBeTruthy();
    expect(spyPass.called).toBeFalsy();
  });

  it('should submit if no errors', () => {
    component.checkFileUploadValidity = () => {};
    component.applicationForm = component.formBuilder.group({
      liabilityInsurance: ['', [Validators.required]]
    });
    component.applicationForm.controls['liabilityInsurance'].setValue('meow mix');
    component.dateStatus.hasErrors = false;
    component.invalidFileUpload = false;
    const spyFail = sinon.spy(component.applicationFieldsService, 'scrollToFirstError');
    const spyPass = sinon.spy(component.applicationService, 'create');

    component.onSubmit();
    expect(spyFail.called).toBeFalsy();
    expect(spyPass.called).toBeTruthy();
  });

  it('should make fileupload invalid if no files', () => {
    const queryStub = sinon.stub(window.document, 'querySelectorAll').returns([]);
    component.checkFileUploadValidity();
    expect(component.invalidFileUpload).toBeFalsy();
    queryStub.restore();
  });

  it('should make fileupload valid if files', () => {
    const queryStub = sinon.stub(window.document, 'querySelectorAll').returns(['meowMix']);
    component.checkFileUploadValidity();
    expect(component.invalidFileUpload).toBeTruthy();
    queryStub.restore();
  });

  it('should add class if in view', () => {
    const target = document.body;
    const addClassSpy = sinon.spy(component.renderer, 'addClass');
    const removeClassSpy = sinon.spy(component.renderer, 'removeClass');
    component.elementInView({ value: 'meowmix', target: target });
    expect(addClassSpy.called).toBeTruthy();
    expect(removeClassSpy.called).toBeFalsy();
  });

  it('should remove class if in view', () => {
    const target = document.body;
    const addClassSpy = sinon.spy(component.renderer, 'addClass');
    const removeClassSpy = sinon.spy(component.renderer, 'removeClass');
    component.elementInView({ target: target });
    expect(addClassSpy.called).toBeFalsy();
    expect(removeClassSpy.called).toBeTruthy();
  });

  it('should reset file error status on retryFileUpload', () => {
    component.fileUploadError = true;
    component.uploadFiles = false;
    component.applicationFieldsService.setFileUploadError(true);
    component.retryFileUpload(new Event('click'));
    expect(component.fileUploadError).toBeFalsy();
    expect(component.uploadFiles).toBeTruthy();
    expect(component.applicationFieldsService.fileUploadError).toBeFalsy();
  });

  it('should trigger doCheck function', () => {
    component.applicationFieldsService.setFileUploadError(true);
    component.uploadFiles = true;
    component.ngDoCheck();
    expect(component.uploadFiles).toBeFalsy();
    expect(component.fileUploadError).toBeTruthy();
  });

  it('should remove unused data', () => {
    component.removeUnusedData();
    expect(component.applicationForm.get('applicantInfo.eveningPhone')).toBeFalsy();
  });

  it('should return application', () => {
    component.getApplication(111);
    expect(component.apiErrors).toEqual('The application could not be found.');
    component.getApplication('111');
    expect(component.applicationForm.get('appControlNumber').value).toEqual('222');
  });
});

class MockApplicationService {
  getOne(id): Observable<{}> {
    if (id === '111') {
      return Observable.of(tempOutfitterMock);
    } else {
      return Observable.throw(['Server Error']);
    }
  }

  handleStatusCode(e) {
    return e;
  }

  get(): Observable<{}> {
    return Observable.of();
  }

  create(): Observable<{}> {
    return Observable.of();
  }

  update(): Observable<{}> {
    return Observable.of();
  }
}
